// uBlockVanced - the per-row dialog: details, dynamic URL rule, static filter.
//
// Every `loggerUI` message upstream sends from this dialog is sent here with
// the same name and payload: getDomainNames, hasInMemoryFilter,
// toggleInMemoryFilter, listsFromNetFilter, listsFromCosmeticFilter,
// getURLFilteringData, setURLFilteringRule, saveURLFilteringRules,
// launchElementPicker, reloadTab and createUserFilter.

import {
    COLUMN_PARTYNESS,
    type EntryView,
    createTargetURLs,
    hostnameFromURI,
    hrefForURL,
    originCandidates,
    reIsExceptionFilter,
    reSchemeOnly,
    shortenLongString,
    staticFilterTypes,
    toExceptionFilter,
    uglyRequestTypes,
} from '../model';
import { Dialog } from 'material-expressive-react/dialog';
import { FilledButton, FilledTonalButton, TextButton } from 'material-expressive-react/button';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { OutlinedSegmentedButton, OutlinedSegmentedButtonSet } from 'material-expressive-react';
import { OutlinedSelect, SelectOption } from 'material-expressive-react/select';
import { SecondaryTab, Tabs } from 'material-expressive-react/tabs';
import { Textfield } from 'material-expressive-react/textfield';
import type { MdTabs } from '@material/web/tabs/tabs.js';
import { loggerIcons } from '../icons';
import { send } from '../../../shared/vapi';
import { t, tOr } from '../../../shared/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { withFlags } from '../../../shared/Flags';

/******************************************************************************/

interface ListEntry { assetKey: string; title: string; supportURL?: string }
type ListsResponse = Record<string, ListEntry[]>;
interface ColorEntry { r: number; own: boolean }
interface ColorsResponse { dirty: boolean; colors: Record<string, ColorEntry> }

type Pane = 'details' | 'dynamic' | 'static';
const PANES: Pane[] = [ 'details', 'dynamic', 'static' ];
const PANE_LABELS: Record<Pane, string> = {
    details: 'loggerEntryDetailsHeader',
    dynamic: 'loggerURLFilteringHeader',
    static: 'loggerStaticFilteringHeader',
};

interface Props {
    view: EntryView | null;
    onClose(): void;
}

/******************************************************************************/

export function EntryDialog({ view, onClose }: Props) {
    const [ pane, setPane ] = useState<Pane>('details');
    const [ domains, setDomains ] = useState<string[]>([ '', '', '' ]);
    const [ lists, setLists ] = useState<{ filter: string; entries: ListEntry[] } | null>(null);
    const [ listsDone, setListsDone ] = useState(false);
    const [ exceptor, setExceptor ] = useState<{ shown: boolean; on: boolean }>({ shown: false, on: false });
    const [ preview, setPreview ] = useState(false);
    const [ colors, setColors ] = useState<Record<string, ColorEntry>>({});
    const [ dynamicOrigin, setDynamicOrigin ] = useState('');
    const [ dynamicType, setDynamicType ] = useState('');
    const [ staticAction, setStaticAction ] = useState('');
    const [ staticType, setStaticType ] = useState('');
    const [ staticUrl, setStaticUrl ] = useState('');
    const [ staticOrigin, setStaticOrigin ] = useState('');
    const [ staticImportance, setStaticImportance ] = useState('');
    const [ created, setCreated ] = useState<string[]>([]);

    const targetURLs = useMemo(
        () => view !== null ? createTargetURLs(view.url) : [],
        [ view ],
    );
    const targetTabId = view?.entry.tabId ?? 0;
    const targetType = view !== null ? view.type.trim() : '';
    const pageHostname = view?.tabHostname ?? '';
    const frameHostname = view?.docHostname ?? '';

    /**************************************************************************/

    // Reset for each newly opened row, then pull the root domain names --
    // upstream does the same before it fills any pane.
    useEffect(() => {
        if ( view === null ) { return; }
        setPane('details');
        setPreview(false);
        setLists(null);
        setListsDone(false);
        setExceptor({ shown: false, on: false });
        setColors({});
        let cancelled = false;
        void send<string[]>('loggerUI', {
            what: 'getDomainNames',
            targets: [ targetURLs[0] ?? '', pageHostname, frameHostname ],
        }).then(response => {
            if ( cancelled ) { return; }
            setDomains(Array.isArray(response) ? response : [ '', '', '' ]);
        });
        return () => { cancelled = true; };
    }, [ frameHostname, pageHostname, targetURLs, view ]);

    const targetDomain = domains[0] ?? '';
    const pageDomain = domains[1] ?? '';
    const frameDomain = domains[2] ?? '';

    /**************************************************************************/

    // Details pane: is there a temporary exception for this filter, and which
    // lists declare it?
    useEffect(() => {
        if ( view === null || view.canLookup === false ) { return; }
        let cancelled = false;
        const filter = view.filterText;
        const isException = reIsExceptionFilter.test(filter);
        const resolve = async () => {
            let on = false;
            if ( isException ) {
                on = await send<boolean>('loggerUI', {
                    what: 'hasInMemoryFilter',
                    filter: toExceptionFilter(filter, view.isExtended),
                }) === true;
            }
            if ( cancelled ) { return; }
            setExceptor({ shown: isException === false || on, on });
        };
        void resolve();
        return () => { cancelled = true; };
    }, [ view ]);

    useEffect(() => {
        if ( view === null || view.canLookup === false ) { return; }
        let cancelled = false;
        const rawFilter = view.filterText;
        const lookup = async () => {
            let response: ListsResponse | undefined;
            if ( view.isNetwork ) {
                response = await send<ListsResponse>('loggerUI', { what: 'listsFromNetFilter', rawFilter });
            } else if ( view.isExtended ) {
                response = await send<ListsResponse>('loggerUI', {
                    what: 'listsFromCosmeticFilter',
                    url: view.url,
                    rawFilter,
                });
            }
            if ( cancelled ) { return; }
            let best = '';
            if ( response instanceof Object ) {
                for ( const key in response ) {
                    if ( key.length <= best.length ) { continue; }
                    best = key;
                }
            }
            if ( best !== '' && response !== undefined && Array.isArray(response[best]) ) {
                setLists({ filter: best, entries: response[best] });
            }
            setListsDone(true);
        };
        void lookup();
        return () => { cancelled = true; };
    }, [ view ]);

    /**************************************************************************/

    // Dynamic pane.
    const dynamicOrigins = useMemo(
        () => pageHostname !== '' ? [ ...originCandidates(pageHostname, pageDomain), '*' ] : [ '*' ],
        [ pageDomain, pageHostname ],
    );
    const dynamicEnabled = view !== null &&
        view.isExtended === false &&
        targetType !== 'doc' &&
        targetURLs.length !== 0 &&
        reSchemeOnly.test(targetURLs[0]) === false;

    useEffect(() => {
        setDynamicOrigin(dynamicOrigins[0] ?? '*');
        setDynamicType(targetType);
    }, [ dynamicOrigins, targetType ]);

    const uglyDynamicType = uglyRequestTypes[dynamicType] || dynamicType;

    const colorize = useCallback(async () => {
        if ( dynamicEnabled === false || dynamicOrigin === '' ) { return; }
        const response = await send<ColorsResponse>('loggerUI', {
            what: 'getURLFilteringData',
            context: dynamicOrigin,
            urls: targetURLs,
            type: uglyDynamicType,
        });
        if ( response instanceof Object && response.colors instanceof Object ) {
            setColors(response.colors);
        }
    }, [ dynamicEnabled, dynamicOrigin, targetURLs, uglyDynamicType ]);

    useEffect(() => { void colorize(); }, [ colorize ]);

    const setRule = async (url: string, action: number, persist: boolean) => {
        await send('loggerUI', {
            what: 'setURLFilteringRule',
            context: dynamicOrigin,
            url,
            type: uglyDynamicType,
            action,
            persist,
        });
        void colorize();
    };

    const saveRules = async () => {
        await send('loggerUI', {
            what: 'saveURLFilteringRules',
            context: dynamicOrigin,
            urls: targetURLs,
            type: uglyDynamicType,
        });
        void colorize();
    };

    /**************************************************************************/

    // Static pane: the same sentence, the same option ladders, and the same
    // filter assembly as upstream's parseStaticInputs().
    const staticOrigins = useMemo(
        () => frameHostname !== '' ? originCandidates(frameHostname, frameDomain) : [],
        [ frameDomain, frameHostname ],
    );
    const staticUrls = useMemo(
        () => targetURLs.map(url => url.replace(/^[a-z-]+:\/\//, '')),
        [ targetURLs ],
    );
    const staticTypeValue = staticFilterTypes[targetType] || targetType;

    useEffect(() => {
        setStaticAction('');
        setStaticType(staticTypeValue);
        setStaticUrl(staticUrls[0] ?? '');
        setStaticOrigin(staticOrigins[0] ?? '');
        setStaticImportance('');
    }, [ staticOrigins, staticTypeValue, staticUrls ]);

    const staticFilter = useMemo(() => {
        const options: string[] = [];
        const block = staticAction === '';
        let filter = block ? '' : '@@';
        let value = staticUrl;
        if ( value !== '' ) {
            if ( reSchemeOnly.test(value) ) {
                value = `|${value}`;
            } else {
                if ( /[/?]/.test(value) === false ) { value += '^'; }
                value = `||${value}`;
            }
        }
        filter += value;
        if ( staticType !== '' ) { options.push(staticFilterTypes[staticType] || staticType); }
        if ( staticOrigin !== '' ) {
            options.push(staticOrigin === targetDomain ? '1p' : `domain=${staticOrigin}`);
        }
        if ( block && staticImportance !== '' ) { options.push('important'); }
        if ( options.length !== 0 ) { filter += '$' + options.join(','); }
        return filter;
    }, [ staticAction, staticImportance, staticOrigin, staticType, staticUrl, targetDomain ]);

    const [ staticDraft, setStaticDraft ] = useState('');
    useEffect(() => { setStaticDraft(staticFilter); }, [ staticFilter ]);

    const createStaticFilter = () => {
        const value = staticDraft.replace(/^((?:@@)?\/.+\/)(\$|$)/, '$1*$2');
        if ( value === '' || created.includes(value) ) { return; }
        setCreated(list => [ ...list, value ]);
        void send('loggerUI', {
            what: 'createUserFilter',
            autoComment: true,
            filters: value,
            docURL: `https://${frameHostname}/`,
        });
    };

    /**************************************************************************/

    if ( view === null ) { return null; }

    const canPreview = targetType === 'image' && view.isNetwork && view.status !== '1';
    const canPick = targetTabId >= 0 && canPreview;
    const panes = dynamicEnabled ? PANES : PANES.filter(name => name !== 'dynamic');
    const activeIndex = Math.max(0, panes.indexOf(pane));
    const cells = view.cells;

    const detailRow = (labelKey: string, value: React.ReactNode, key: string) => (
        <div className="ubv-logger-detail" key={key}>
            <span>{t(labelKey)}</span>
            <span>{value}</span>
        </div>
    );

    return (
        <Dialog
            className="ubv-dialog ubv-logger-dialog netFilteringDialog"
            open={view !== null}
            onClosed={onClose}
            aria-labelledby="loggerEntryTitle"
        >
            <div slot="headline" className="ubv-logger-dialog-head">
                <span id="loggerEntryTitle">{t('loggerEntryDetailsHeader')}</span>
                <span className="ubv-logger-dialog-tools">
                    {canPick ? (
                        <IconButton
                            variant="standard"
                            aria-label={t('loggerEntryDetailsURL')}
                            onClick={() => {
                                void send('loggerUI', {
                                    what: 'launchElementPicker',
                                    tabId: targetTabId,
                                    targetURL: 'img\t' + (targetURLs[0] ?? ''),
                                    select: true,
                                });
                            }}
                        >
                            <Icon svg={loggerIcons.external} />
                        </IconButton>
                    ) : null}
                    <IconButton
                        variant="standard"
                        aria-label={t('loggerReloadTip')}
                        onClick={ev => {
                            const mouse = ev as unknown as MouseEvent;
                            void send('loggerUI', {
                                what: 'reloadTab',
                                tabId: targetTabId,
                                bypassCache: mouse.ctrlKey || mouse.metaKey || mouse.shiftKey,
                            });
                        }}
                    >
                        <Icon svg={loggerIcons.refresh} />
                    </IconButton>
                </span>
            </div>

            <div slot="content" className="ubv-logger-dialog-body">
                <Tabs
                    className="ubv-tabs"
                    activeTabIndex={activeIndex}
                    aria-label={t('loggerEntryDetailsHeader')}
                    onChange={ev => {
                        const el = ev.target as MdTabs;
                        const next = panes[el.activeTabIndex];
                        if ( next !== undefined ) { setPane(next); }
                    }}
                >
                    {panes.map(name => (
                        <SecondaryTab key={name}>{t(PANE_LABELS[name])}</SecondaryTab>
                    ))}
                </Tabs>

                {pane === 'details' ? (
                    <div className="pane details" data-pane="details">
                        {canPreview ? (
                            <div className="ubv-logger-preview">
                                {preview
                                    ? <img src={view.url} alt="" />
                                    : <FilledTonalButton onClick={() => { setPreview(true); }}>
                                        {tOr('loggerUiPreview', 'Click to preview')}
                                    </FilledTonalButton>}
                            </div>
                        ) : null}

                        {view.filterText !== '' && (view.isExtended || view.isNetwork)
                            ? (
                                <div className="ubv-logger-detail" key="filter">
                                    <span>{t('loggerEntryDetailsFilter')}</span>
                                    <span>{view.filterText}</span>
                                    {exceptor.shown ? (
                                        <TextButton
                                            className={exceptor.on ? 'exceptored' : undefined}
                                            onClick={() => {
                                                void send<boolean>('loggerUI', {
                                                    what: 'toggleInMemoryFilter',
                                                    filter: toExceptionFilter(view.filterText, view.isExtended),
                                                }).then(status => {
                                                    setExceptor({ shown: true, on: status === true });
                                                });
                                            }}
                                        >
                                            {tOr('loggerUiExceptor', 'Except')}
                                        </TextButton>
                                    ) : null}
                                </div>
                            )
                            : null}

                        {view.canLookup ? (
                            <div className="ubv-logger-detail" key="lists">
                                <span>{t('loggerEntryDetailsFilterList')}</span>
                                <span className="prose">
                                    {lists !== null
                                        ? lists.entries.map(list => (
                                            <span className="listEntry" key={list.assetKey}>
                                                <a
                                                    href={`asset-viewer.html?url=${encodeURIComponent(list.assetKey)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >{withFlags(list.title)}</a>
                                                {list.supportURL ? (
                                                    <>
                                                        {' '}
                                                        <a
                                                            href={list.supportURL}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title={t('loggerOpenSupportTip')}
                                                            aria-label={t('loggerOpenSupportTip')}
                                                        >↗</a>
                                                    </>
                                                ) : null}
                                            </span>
                                        ))
                                        : listsDone
                                            ? t('loggerStaticFilteringFinderSentence2')
                                            : null}
                                </span>
                            </div>
                        ) : null}

                        {view.isRule && view.filterText !== ''
                            ? detailRow('loggerEntryDetailsRule', view.filterText, 'rule')
                            : null}
                        {view.tabHostname !== '' && view.tabHostname !== view.docHostname
                            ? detailRow('loggerEntryDetailsRootContext', view.tabHostname, 'root')
                            : null}
                        {view.docHostname !== ''
                            ? detailRow('loggerEntryDetailsContext', view.docHostname, 'ctx')
                            : null}
                        {view.parties !== ''
                            ? detailRow(
                                'loggerEntryDetailsPartyness',
                                `(${cells[COLUMN_PARTYNESS] ?? ''}) ${view.parties}`,
                                'party',
                            )
                            : null}
                        {view.type !== ''
                            ? detailRow('loggerEntryDetailsType', view.type, 'type')
                            : null}
                        {view.url !== ''
                            ? (
                                <div
                                    className="ubv-logger-detail"
                                    key="url"
                                    data-status={view.status !== '' ? view.status : undefined}
                                    data-modifier={view.modifier ? '' : undefined}
                                >
                                    <span>{t('loggerEntryDetailsURL')}</span>
                                    <span>
                                        {hrefForURL(view.url, view.type) !== undefined
                                            ? <a
                                                href={hrefForURL(view.url, view.type)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >{view.url}</a>
                                            : view.url}
                                    </span>
                                </div>
                            )
                            : null}
                        {view.aliasURL !== '' ? (
                            <>
                                {detailRow(
                                    'loggerEntryDetailsURL',
                                    `${hostnameFromURI(view.aliasURL)} ⇒\n ${hostnameFromURI(view.url)}`,
                                    'cname',
                                )}
                                <div className="ubv-logger-detail" key="origurl">
                                    <span>Original URL</span>
                                    <span>{view.aliasURL}</span>
                                </div>
                            </>
                        ) : null}
                    </div>
                ) : null}

                {pane === 'dynamic' && dynamicEnabled ? (
                    <div className="pane dynamic" data-pane="dynamic">
                        <div className="ubv-logger-dynamic-head">
                            <OutlinedSelect
                                className="ubv-field"
                                label={t('loggerURLFilteringContextLabel')}
                                value={dynamicOrigin}
                                onChange={ev => {
                                    setDynamicOrigin((ev.target as unknown as { value: string }).value);
                                }}
                            >
                                {dynamicOrigins.map(origin => (
                                    <SelectOption key={origin} value={origin} selected={origin === dynamicOrigin}>
                                        <div slot="headline">
                                            {origin === '*'
                                                ? '*'
                                                : t('loggerStaticFilteringSentencePartOrigin').replace('{{origin}}', origin)}
                                        </div>
                                    </SelectOption>
                                ))}
                            </OutlinedSelect>
                            <OutlinedSelect
                                className="ubv-field"
                                label={t('loggerURLFilteringTypeLabel')}
                                value={dynamicType}
                                onChange={ev => {
                                    setDynamicType((ev.target as unknown as { value: string }).value);
                                }}
                            >
                                <SelectOption value={targetType} selected={dynamicType === targetType}>
                                    <div slot="headline">{targetType}</div>
                                </SelectOption>
                                <SelectOption value="*" selected={dynamicType === '*'}>
                                    <div slot="headline">*</div>
                                </SelectOption>
                            </OutlinedSelect>
                            <IconButton
                                id="saveRules"
                                variant="standard"
                                aria-label={t('loggerURLFilteringHeader')}
                                onClick={() => { void saveRules(); }}
                            >
                                <Icon svg={loggerIcons.commit} />
                            </IconButton>
                        </div>
                        <div className="entries">
                            {targetURLs.map(url => {
                                const color = colors[url];
                                const value = color === undefined
                                    ? ''
                                    : color.r === 2 ? 'allow' : color.r === 3 ? 'noop' : color.r === 1 ? 'block' : '';
                                return (
                                    <div className="entry row" key={url}>
                                        <OutlinedSegmentedButtonSet
                                            selectType="single"
                                            value={value}
                                            aria-label={url}
                                            onClick={(next, selected) => {
                                                const action = selected === false
                                                    ? 0
                                                    : next === 'allow' ? 2 : next === 'noop' ? 3 : 1;
                                                void setRule(url, action, false);
                                            }}
                                        >
                                            <OutlinedSegmentedButton value="allow" label="allow" />
                                            <OutlinedSegmentedButton value="noop" label="noop" />
                                            <OutlinedSegmentedButton value="block" label="block" />
                                        </OutlinedSegmentedButtonSet>
                                        <span className="url">{shortenLongString(url, 128)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : null}

                {pane === 'static' ? (
                    <div className="pane static" data-pane="static">
                        <div className="ubv-logger-sentence">
                            <OutlinedSelect
                                className="ubv-field"
                                value={staticAction}
                                label={t('loggerStaticFilteringHeader')}
                                onChange={ev => { setStaticAction((ev.target as unknown as { value: string }).value); }}
                            >
                                <SelectOption value="" selected={staticAction === ''}>
                                    <div slot="headline">{t('loggerStaticFilteringSentencePartBlock')}</div>
                                </SelectOption>
                                <SelectOption value="@@" selected={staticAction === '@@'}>
                                    <div slot="headline">{t('loggerStaticFilteringSentencePartAllow')}</div>
                                </SelectOption>
                            </OutlinedSelect>
                            <OutlinedSelect
                                className="ubv-field"
                                value={staticType}
                                label={t('loggerEntryDetailsType')}
                                onChange={ev => { setStaticType((ev.target as unknown as { value: string }).value); }}
                            >
                                <SelectOption value={staticTypeValue} selected={staticType === staticTypeValue}>
                                    <div slot="headline">
                                        {t('loggerStaticFilteringSentencePartType').replace('{{type}}', staticTypeValue)}
                                    </div>
                                </SelectOption>
                                <SelectOption value="" selected={staticType === ''}>
                                    <div slot="headline">{t('loggerStaticFilteringSentencePartAnyType')}</div>
                                </SelectOption>
                            </OutlinedSelect>
                            <OutlinedSelect
                                className="ubv-field"
                                value={staticUrl}
                                label={t('loggerEntryDetailsURL')}
                                onChange={ev => { setStaticUrl((ev.target as unknown as { value: string }).value); }}
                            >
                                {staticUrls.map(url => (
                                    <SelectOption key={url} value={url} selected={url === staticUrl}>
                                        <div slot="headline">{shortenLongString(url, 128)}</div>
                                    </SelectOption>
                                ))}
                            </OutlinedSelect>
                            <OutlinedSelect
                                className="ubv-field"
                                value={staticOrigin}
                                label={t('loggerEntryDetailsContext')}
                                onChange={ev => { setStaticOrigin((ev.target as unknown as { value: string }).value); }}
                            >
                                {staticOrigins.map(origin => (
                                    <SelectOption key={origin} value={origin} selected={origin === staticOrigin}>
                                        <div slot="headline">
                                            {t('loggerStaticFilteringSentencePartOrigin').replace('{{origin}}', origin)}
                                        </div>
                                    </SelectOption>
                                ))}
                                <SelectOption value="" selected={staticOrigin === ''}>
                                    <div slot="headline">{t('loggerStaticFilteringSentencePartAnyOrigin')}</div>
                                </SelectOption>
                            </OutlinedSelect>
                            <OutlinedSegmentedButtonSet
                                selectType="single"
                                value={staticImportance}
                                aria-label={t('loggerStaticFilteringSentencePartImportant')}
                                onChange={value => { setStaticImportance(value as string); }}
                            >
                                <OutlinedSegmentedButton
                                    value=""
                                    label={t('loggerStaticFilteringSentencePartNotImportant')}
                                />
                                <OutlinedSegmentedButton
                                    value="important"
                                    label={t('loggerStaticFilteringSentencePartImportant')}
                                />
                            </OutlinedSegmentedButtonSet>
                        </div>
                        <Textfield
                            className="ubv-field staticFilter"
                            variant="outlined"
                            type="textarea"
                            rows={3}
                            value={staticDraft}
                            aria-label={t('loggerStaticFilteringHeader')}
                            onInput={ev => { setStaticDraft((ev.target as unknown as { value: string }).value); }}
                        />
                        <div className="ubv-actions">
                            <FilledButton
                                id="createStaticFilter"
                                disabled={staticDraft === '' || created.includes(staticDraft)}
                                onClick={createStaticFilter}
                            >
                                {t('pickerCreate')}
                            </FilledButton>
                        </div>
                    </div>
                ) : null}
            </div>

            <div slot="actions" className="ubv-dialog-actions">
                <TextButton onClick={onClose}>{t('loggerCloseDialogTip')}</TextButton>
            </div>
        </Dialog>
    );
}

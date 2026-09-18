import { FilledButton, FilledTonalButton, OutlinedButton, TextButton } from 'material-expressive-react/button';
import { Checkbox } from 'material-expressive-react/checkbox';
import { CircularProgress } from 'material-expressive-react/progress';
import { OutlinedSelect, SelectOption } from 'material-expressive-react/select';
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Icon } from '../../shared/Icon';
import { ListItem } from '../../shared/ListItem';
import { icons } from '../../shared/icons';
import { Tooltips } from '../../shared/Tooltip';
import { t } from '../../shared/i18n';
import { Prose, useProse } from './Prose';
import { supportIcons } from './icons';
import { gotoURL, useSupport } from './useSupport';
import { Card } from '../../shared/Card';
import { Pill, Pills } from '../../shared/Pill';

interface EntryProps { icon: string; title: string; children: ReactNode; action?: ReactNode }

function Entry({ icon, title, children, action }: EntryProps) {
    return (
        <Card className="ubv-support-entry" aria-label={title}>
            <div className="ubv-support-icon"><Icon svg={icon} /></div>
            <div className="ubv-support-copy">
                <h2 className="ubv-support-title">{title}</h2>
                {children}
            </div>
            {action ? <div className="ubv-support-action">{action}</div> : null}
        </Card>
    );
}

// Read-only CodeMirror showing the troubleshooting report (bespoke widget).
function Diagnostics({ text, showMore }: { text: string; showMore: boolean }) {
    const host = useRef<HTMLDivElement>(null);
    const cm = useRef<CMEditor | null>(null);
    useEffect(() => {
        if ( host.current === null ) { return; }
        const editor = new CodeMirror(host.current, { autofocus: true, readOnly: true, styleActiveLine: true });
        uBlockDashboard.patchCodeMirrorEditor(editor);
        cm.current = editor;
    }, []);
    useEffect(() => {
        if ( cm.current === null ) { return; }
        cm.current.setValue(text);
        cm.current.clearHistory();
        cm.current.refresh();
    }, [ text ]);
    return (
        <Card id="supportDiagnostics" className="ubv-diagnostics" aria-label={t('supportS5H')}>
            <div className="ubv-card-header">
                <h2 className="ubv-card-title">{t('supportS5H')}</h2>
                <div className="ubv-actions">
                    <OutlinedButton id="selectAllButton" data-tip={t('genericSelectAll')} onClick={() => {
                        cm.current?.focus();
                        cm.current?.execCommand('selectAll');
                    }}>
                        <Icon slot="icon" svg={supportIcons.selectAll} />
                        {t('genericSelectAll')}
                    </OutlinedButton>
                    {showMore ? (
                        <OutlinedButton id="moreButton" data-tip="/devtools.html" onClick={ev => { gotoURL('/devtools.html', ev.shiftKey); }}>
                            <Icon slot="icon" svg={supportIcons.more} />
                            {t('popupMoreButton_v2')}
                        </OutlinedButton>
                    ) : null}
                </div>
            </div>
            <p className="ubv-muted">{t('supportS5P1')}</p>
            <div id="supportData" ref={host} className="codeMirrorContainer"></div>
        </Card>
    );
}

const issueTypes: Array<[ string, string ]> = [
    [ 'ads', 'supportS6Select1Option1' ],
    [ 'detection', 'supportS6Select1Option3' ],
    [ 'popups', 'supportS6Select1Option6' ],
    [ 'nuisance', 'supportS6Select1Option2' ],
    [ 'breakage', 'supportS6Select1Option5' ],
    [ 'privacy', 'supportS6Select1Option4' ],
    [ 'badware', 'supportS6Select1Option7' ],
];

// The NSFW setting: the row is the hit area, the Checkbox rides in the end
// slot, and a click that started on the checkbox or on a link inside the
// label is left alone so the setting never toggles twice.
function NsfwRow({ checked, onToggle }: { checked: boolean; onToggle: (value: boolean) => void }) {
    const label = useProse(t('supportS6Checkbox1'));
    const onRow = (ev: MouseEvent<HTMLElement>) => {
        if ( (ev.target as HTMLElement).closest('md-checkbox, md-text-button') !== null ) { return; }
        onToggle(checked === false);
    };
    return (
        <ListItem type="button" className="ubv-nsfw-row" onClick={onRow}>
            <div slot="headline" className="ubv-support-html">{label}</div>
            <Checkbox slot="end" id="isNSFW" checked={checked}
                onChange={ev => { onToggle((ev.target as HTMLInputElement).checked); }} />
        </ListItem>
    );
}

// The filter-issue reporter shown when opened from the popup (?pageURL=...).
function FilterIssueReporter() {
    const [ state, actions ] = useSupport();
    const reported = state.reported;
    const [ url, setUrl ] = useState(reported?.urls[0] ?? '');
    const [ type, setType ] = useState('[unknown]');
    const [ nsfw, setNsfw ] = useState(false);
    // A malformed pageURL falls back to the plain support page, as upstream.
    if ( reported === null ) { return <SupportHome />; }
    const needsUpdate = reported.shouldUpdateLists !== null;
    const createLocked = needsUpdate && state.updated === false;
    return (
        <div className={'ubv-page ubv-support' + (state.updating ? ' updating' : '')}>
            <header className="ubv-page-header">
                <div className="ubv-page-copy">
                    <div className="ubv-eyebrow" translate="no">uBlockVanced</div>
                    <h1 className="ubv-title">{t('supportS6H')}</h1>
                    <Prose k="supportS3P1" className="ubv-lead ubv-support-html" />
                </div>
                <Pills><Pill tone="accent" label={reported.hostname} /></Pills>
            </header>

            {needsUpdate ? (
                <Entry icon={icons.refresh} title={t('3pUpdateNow')} action={
                    state.updated
                        ? <Pill tone="accent" role="status" aria-live="polite" label={t('supportS6P2S2')} />
                        : (
                            <FilledTonalButton disabled={state.updating} data-tip={t('3pUpdateNow')} onClick={() => { actions.updateFilterLists(); }}>
                                {state.updating
                                    ? <CircularProgress slot="icon" indeterminate className="ubv-button-progress" />
                                    : <Icon slot="icon" svg={icons.refresh} />}
                                {t('3pUpdateNow')}
                            </FilledTonalButton>
                        )
                }>
                    <p className="ubv-muted">{t('supportS6P2S1')}</p>
                </Entry>
            ) : null}

            <Entry icon={icons.search} title={t('supportFindSpecificButton')} action={
                <OutlinedButton data-tip={t('supportFindSpecificButton')} onClick={() => { actions.findSimilarReports(); }}>
                    <Icon slot="icon" svg={icons.external} />
                    {t('supportFindSpecificButton')}
                </OutlinedButton>
            }>
                <Prose k="supportS6P1S1" className="ubv-muted ubv-support-html" />
            </Entry>

            <Card className={'ubv-report' + (createLocked ? ' is-locked' : '')} aria-label={t('supportReportSpecificButton')}>
                <div className="ubv-card-header"><h2 className="ubv-card-title">{t('supportReportSpecificButton')}</h2></div>
                <OutlinedSelect className="ubv-field" label={t('supportS6URL')} value={url}
                    onChange={ev => { setUrl((ev.target as HTMLSelectElement).value); }}>
                    {reported.urls.map(u => (
                        <SelectOption key={u} value={u} selected={u === url}><div slot="headline">{u}</div></SelectOption>
                    ))}
                </OutlinedSelect>
                <OutlinedSelect className="ubv-field" label={t('supportS6Select1')} value={type}
                    onChange={ev => { setType((ev.target as HTMLSelectElement).value); }}>
                    <SelectOption value="[unknown]" disabled selected={type === '[unknown]'}>
                        <div slot="headline">{t('supportS6Select1Option0')}</div>
                    </SelectOption>
                    {issueTypes.map(([ value, key ]) => (
                        <SelectOption key={value} value={value} selected={value === type}><div slot="headline">{t(key)}</div></SelectOption>
                    ))}
                </OutlinedSelect>
                <NsfwRow checked={nsfw} onToggle={setNsfw} />
                <div className="ubv-actions">
                    <FilledButton disabled={createLocked || type === '[unknown]'} data-tip={t('supportReportSpecificButton')}
                        onClick={() => { actions.reportSpecificIssue(url, type, nsfw); }}>
                        <Icon slot="icon" svg={supportIcons.report} />
                        {t('supportReportSpecificButton')}
                    </FilledButton>
                </div>
            </Card>

            {state.diagnosticsShown
                ? <Diagnostics text={state.text} showMore={false} />
                : (
                    <div className="ubv-actions">
                        <TextButton id="showSupportInfo" aria-expanded="false" aria-controls="supportDiagnostics"
                            onClick={() => { actions.showDiagnostics(); }}>
                            <Icon slot="icon" svg={icons.more} />
                            {t('supportS5H')}
                        </TextButton>
                    </div>
                )}
            <Tooltips />
        </div>
    );
}

function SupportHome() {
    const [ state ] = useSupport();
    const open = (url: string, id?: string) => (
        <FilledTonalButton id={id} data-tip={url} onClick={ev => { gotoURL(url, ev.shiftKey); }}>
            <Icon slot="icon" svg={icons.external} />
            {t('supportOpenButton')}
        </FilledTonalButton>
    );
    return (
        <div className="ubv-page ubv-support">
            <header className="ubv-page-header">
                <div className="ubv-page-copy">
                    <div className="ubv-eyebrow" translate="no">uBlockVanced</div>
                    <h1 className="ubv-title">{t('supportPageName')}</h1>
                </div>
            </header>
            <Entry icon={supportIcons.docs} title={t('supportS1H')} action={open('https://github.com/gorhill/uBlock/wiki')}>
                <Prose k="supportS1P1" className="ubv-muted ubv-support-html" />
            </Entry>
            <Entry icon={supportIcons.forum} title={t('supportS2H')} action={open('https://www.reddit.com/r/uBlockOrigin/')}>
                <Prose k="supportS2P1" className="ubv-muted ubv-support-html" />
            </Entry>
            <Entry icon={supportIcons.report} title={t('supportS3H')} action={open(state.filterReportURL, 'filterReport')}>
                <Prose k="supportS3P1" className="ubv-muted ubv-support-html" />
                <Prose k="supportS3P2" className="ubv-muted ubv-support-html" />
                <Prose k="supportS3P3" className="ubv-muted ubv-support-html" />
            </Entry>
            <Entry icon={supportIcons.bug} title={t('supportS4H')} action={open(state.bugReportURL, 'bugReport')}>
                <Prose k="supportS4P1" className="ubv-muted ubv-support-html" />
            </Entry>
            <Diagnostics text={state.text} showMore />
            <Tooltips />
        </div>
    );
}

export function App() {
    // Same URL contract as upstream: ?pageURL=... switches to the reporter.
    const isFilterIssue = new URL(self.location.href).searchParams.get('pageURL') !== null;
    return isFilterIssue ? <FilterIssueReporter /> : <SupportHome />;
}

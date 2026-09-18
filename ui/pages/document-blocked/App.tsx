import { Badge } from 'material-expressive-react/badge';
import { FilledButton, OutlinedButton, TextButton } from 'material-expressive-react/button';
import { Checkbox } from 'material-expressive-react/checkbox';
import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { withFlags } from '../../shared/Flags';
import { Icon } from '../../shared/Icon';
import { IconButton } from '../../shared/IconButton';
import { List, ListItem } from '../../shared/ListItem';
import { icons } from '../../shared/icons';
import { Tooltips } from '../../shared/Tooltip';
import { t, tf } from '../../shared/i18n';
import { pageIcons } from './icons';
import { reURL, useDocumentBlocked } from './useDocumentBlocked';
import { Card } from '../../shared/Card';
import { Pill } from '../../shared/Pill';

// A URL with its hostname emphasised, as upstream urlToFragment().
function UrlText({ raw }: { raw: string }) {
    try {
        const hn = new URL(raw).hostname;
        const i = raw.indexOf(hn);
        return <>{raw.slice(0, i)}<b>{hn}</b>{raw.slice(i + hn.length)}</>;
    } catch {
        return <>{raw}</>;
    }
}

// A parameter value: plain text, or a text button opening the nested URL.
function ParamValue({ value }: { value: string }) {
    if ( reURL.test(value) === false ) { return <>{value}</>; }
    return <TextButton className="ubv-param-link" href={value} data-tip={value}>{value}</TextButton>;
}

// The blocked URL's query string, one list row per parameter, nested URLs
// expanded up to two levels (upstream renderParams). A nested parameter set
// is a nested list placed right after the row that carries it.
function Params({ rawURL, depth = 0 }: { rawURL: string; depth?: number }) {
    let url: URL;
    try { url = new URL(rawURL); } catch { return null; }
    const search = url.search.slice(1);
    if ( search === '' ) { return null; }
    url.search = '';
    const rows: ReactNode[] = [
        <ListItem key="base" className="ubv-param">
            <div slot="headline" className="ubv-param-name">{t('docblockedNoParamsPrompt')}</div>
            <div slot="supporting-text" className="ubv-param-value"><ParamValue value={url.href} /></div>
        </ListItem>,
    ];
    let n = 0;
    for ( const [ rawName, rawValue ] of new URLSearchParams(search) ) {
        const name = rawValue === '' ? '' : rawName;
        const value = rawValue === '' ? rawName : rawValue;
        const nested = depth < 2 && reURL.test(value);
        rows.push(
            <ListItem key={'row' + n} className="ubv-param">
                <div slot="headline" className="ubv-param-name">{name}</div>
                <div slot="supporting-text" className="ubv-param-value"><ParamValue value={value} /></div>
            </ListItem>,
        );
        if ( nested ) {
            rows.push(
                <List key={'nested' + n} className="ubv-params-nested">
                    <Params rawURL={value} depth={depth + 1} />
                </List>,
            );
        }
        n += 1;
    }
    return <>{rows}</>;
}

export function App() {
    const [ state, actions ] = useDocumentBlocked();
    const [ reasonOpen, setReasonOpen ] = useState(false);
    const { details } = state;
    const modeText = t(state.permanent ? 'docblockedDisablePermanent' : 'docblockedDisableTemporary');
    const redirect = typeof details.to === 'string' && details.to.length !== 0 ? details.to : null;
    const redirectText = t('docblockedRedirectPrompt');
    const redirectPos = redirectText.indexOf('{{url}}');
    const wikiHelp = t('docblockedStrictBlockingHelp');

    // The row is the hit area; a click that started on the checkbox is left
    // to the checkbox, so the setting never toggles twice.
    const onWarningRow = (ev: MouseEvent<HTMLElement>) => {
        if ( (ev.target as HTMLElement).closest('md-checkbox') !== null ) { return; }
        actions.setPermanent(state.permanent === false);
    };

    return (
        <div className={'ubv-page ubv-blocked' + (state.ready ? '' : ' loading')}>
            <Card className="ubv-blocked-card" role="main">
                <IconButton variant="tonal" className="ubv-blocked-sign"
                    href="https://github.com/gorhill/uBlock/wiki/Strict-blocking" target="_blank"
                    data-tip={wikiHelp} aria-label={wikiHelp}>
                    <Icon svg={icons.warning} />
                </IconButton>
                <div className="ubv-eyebrow" translate="no">uBlockVanced</div>
                <h1 className="ubv-title">{t('docblockedTitle')}</h1>
                <p className="ubv-muted">{t('docblockedPrompt1')}</p>

                <div id="theURL" className={'ubv-url' + (state.expanded ? '' : ' collapsed')}>
                    <p className="ubv-code">
                        <span><UrlText raw={details.url ?? ''} /></span>
                        {state.canParse ? (
                            <IconButton id="toggleParse" variant="standard" className="ubv-url-toggle"
                                aria-expanded={state.expanded ? 'true' : 'false'}
                                data-tip={t('docblockedToggleDetails')} aria-label={t('docblockedToggleDetails')}
                                onClick={() => { actions.toggleExpanded(); }}>
                                <Icon svg={state.expanded ? pageIcons.zoomOut : pageIcons.zoomIn} />
                            </IconButton>
                        ) : null}
                    </p>
                    {state.canParse && state.expanded ? (
                        <List id="parsed" className="ubv-params"><Params rawURL={details.url ?? ''} /></List>
                    ) : null}
                </div>

                {state.ready ? (
                    <div id="why" className="ubv-why">
                        {state.reason ? (
                            <Card className="ubv-reason">
                                <TextButton className="ubv-reason-toggle" aria-controls="reasonDetails"
                                    aria-expanded={reasonOpen ? 'true' : 'false'}
                                    onClick={() => { setReasonOpen(open => open === false); }}>
                                    <Icon slot="icon" svg={reasonOpen ? icons.less : icons.more} />
                                    {t('docblockedReasonLabel')} {state.reason}
                                </TextButton>
                                {reasonOpen ? (
                                    <div id="reasonDetails" className="ubv-reason-body">
                                        <p className="ubv-muted">{t('docblockedPrompt2')}</p>
                                        <p className="ubv-code">{details.fs}</p>
                                    </div>
                                ) : null}
                            </Card>
                        ) : (
                            <>
                                <p className="ubv-muted">{t('docblockedPrompt2')}</p>
                                <p className="ubv-code">{details.fs}</p>
                            </>
                        )}
                        {state.lists.length !== 0 ? (
                            <div className="ubv-found-in">
                                <span className="ubv-muted">{t('docblockedFoundIn')}</span>
                                {state.lists.map(list => (
                                    <span key={list.assetKey} className="ubv-filter-list">
                                        <TextButton className="ubv-list-link" data-tip={list.title} target="_blank"
                                            href={'asset-viewer.html?url=' + encodeURIComponent(list.assetKey)}>
                                            {withFlags(list.title)}
                                        </TextButton>
                                        {typeof list.supportURL === 'string' && list.supportURL !== '' ? (
                                            <IconButton variant="standard" className="ubv-list-support"
                                                href={list.supportURL} target="_blank"
                                                data-tip={list.supportURL} aria-label={list.supportURL}>
                                                <Icon svg={icons.home} />
                                            </IconButton>
                                        ) : null}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {redirect !== null && redirectPos !== -1 ? (
                    <p id="urlskip" className="ubv-notice ubv-notice-warning">
                        {redirectText.slice(0, redirectPos)}
                        <TextButton className="ubv-redirect-link" href={redirect} data-tip={redirect}>
                            <UrlText raw={redirect} />
                        </TextButton>
                        {redirectText.slice(redirectPos + '{{url}}'.length)}
                    </p>
                ) : null}

                <ListItem type="button" className="ubv-warning-row" onClick={onWarningRow}>
                    <div slot="headline">{t('docblockedDontWarn')}</div>
                    <Checkbox slot="end" id="disableWarning" checked={state.permanent}
                        aria-label={t('docblockedDontWarn')}
                        onChange={ev => { actions.setPermanent((ev.target as HTMLInputElement).checked); }} />
                </ListItem>

                <div id="proceedPanel" className={'ubv-notice ' + (state.permanent ? 'ubv-notice-warning' : 'ubv-notice-info')} role="status" aria-live="polite">
                    <span id="proceedCopy">{tf('docblockedProceed', { hostname: state.hostname })}</span>
                    <Pill id="proceedMode" className="ubv-proceed-mode" label={modeText} />
                </div>

                <div id="actionContainer" className="ubv-actions ubv-blocked-actions">
                    {state.canGoBack ? (
                        <OutlinedButton id="back" disabled={state.permanent} data-tip={t('docblockedBack')} onClick={() => { actions.back(); }}>
                            <Icon slot="icon" svg={pageIcons.back} />
                            {t('docblockedBack')}
                        </OutlinedButton>
                    ) : (
                        <OutlinedButton id="bye" disabled={state.permanent} data-tip={t('docblockedClose')} onClick={() => { actions.close(); }}>
                            <Icon slot="icon" svg={icons.close} />
                            {t('docblockedClose')}
                        </OutlinedButton>
                    )}
                    <span className="ubv-proceed-anchor">
                        <FilledButton id="proceed" data-tip={tf('docblockedProceed', { hostname: state.hostname })}
                            onClick={() => { actions.proceed(); }}>
                            <Icon slot="icon" svg={icons.external} />
                            {t('docblockedDisable')}
                        </FilledButton>
                        <Badge id="proceedActionMode"
                            className={'ubv-proceed-action' + (state.permanent ? ' isPermanent' : '')}
                            value={modeText} />
                    </span>
                </div>
            </Card>
            <Tooltips />
        </div>
    );
}

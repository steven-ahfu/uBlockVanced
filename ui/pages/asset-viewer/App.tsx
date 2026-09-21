import { FilledButton, OutlinedButton, TextButton } from 'material-expressive-react/button';
import { CircularProgress } from 'material-expressive-react/progress';
import { Icon } from '../../shared/Icon';
import { icons } from '../../shared/icons';
import { Tooltips } from '../../shared/Tooltip';
import { t } from '../../shared/i18n';
import { useAssetViewer } from './useAssetViewer';
import { Card } from '../../shared/Card';
import { Pill, Pills } from '../../shared/Pill';
import type { PillTone } from '../../shared/Pill';
import type { Pill as PillData } from './useAssetViewer';

const pillTone = (tone: PillData['tone']): PillTone => {
    switch ( tone ) {
    case 'success': return 'accent';
    case 'warning': return 'warning';
    case 'running': return 'running';
    default: return 'neutral';
    }
};

function StatusPill({ pill, id }: { pill: PillData; id?: string }) {
    return (
        <Pill id={id} tone={pillTone(pill.tone)} label={pill.text}
            icon={pill.tone === 'running' ? <CircularProgress indeterminate className="ubv-pill-progress" /> : undefined} />
    );
}

export function App() {
    const [ host, state, actions ] = useAssetViewer();
    return (
        <div className={'ubv-page ubv-viewer' + (state.loading ? ' loading' : '')}>
            <header className="ubv-page-header">
                <div className="ubv-page-copy">
                    <div className="ubv-eyebrow" translate="no">uBlockVanced</div>
                    <h1 className="ubv-title" id="assetHeading">{state.title}</h1>
                    <p className="ubv-lead">{t('assetViewerLead')}</p>
                    <p className="ubv-muted ubv-asset-meta" id="assetMeta">{state.meta}</p>
                </div>
                <Pills className="ubv-status-cluster" role="status" aria-live="polite" aria-atomic="true">
                    <StatusPill id="assetStatusPrimary" pill={state.status} />
                    {state.trust ? <StatusPill id="assetTrustState" pill={state.trust} /> : null}
                    {state.lines ? <StatusPill id="assetLineCount" pill={state.lines} /> : null}
                    {state.sourceURL ? (
                        <OutlinedButton id="assetSourceLink" href={state.sourceURL} target="_blank"
                            data-tip={state.sourceURL}>
                            <Icon slot="icon" svg={icons.external} />
                            {t('assetViewerOpenSource')}
                        </OutlinedButton>
                    ) : null}
                </Pills>
            </header>

            {state.subscribe && state.subscribed === false ? (
                <Card id="subscribe" className="ubv-subscribe" aria-live="polite" data-busy={state.subscribeBusy ? 'true' : undefined}>
                    <span className="ubv-subscribe-logo"><img src="img/ublock.svg" alt="" title={t('extName')} /></span>
                    <div className="ubv-subscribe-copy">
                        <p className="ubv-eyebrow">{t('assetViewerSubscribeEyebrow')}</p>
                        <p className="ubv-subscribe-title">{state.title}</p>
                        <p className="ubv-muted">{t('assetViewerSubscribeHint')}</p>
                        <TextButton className="ubv-subscribe-target" href={state.assetKey ?? '#'} target="_blank"
                            data-tip={state.assetKey}>{state.assetKey}</TextButton>
                    </div>
                    <div className="ubv-subscribe-actions">
                        <StatusPill id="subscribeState" pill={state.subscribeState} />
                        <FilledButton id="subscribeButton" disabled={state.loading || state.subscribeBusy}
                            data-tip={t('assetViewerSubscribeHint')} onClick={() => { actions.subscribe(); }}>
                            {state.subscribeBusy
                                ? <CircularProgress slot="icon" indeterminate className="ubv-button-progress" />
                                : <Icon slot="icon" svg={icons.add} />}
                            {t('subscribeButton')}
                        </FilledButton>
                    </div>
                </Card>
            ) : null}

            <Card className="ubv-editor-card" aria-label={state.title}>
                <div id="content" ref={host} className="codeMirrorContainer codeMirrorBreakAll cm-theme-override"></div>
            </Card>
            <Tooltips />
        </div>
    );
}

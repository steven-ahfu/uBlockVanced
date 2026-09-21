import { Toolbar } from 'material-expressive-react';
import { FilledButton, TextButton } from 'material-expressive-react/button';
import { Dialog } from 'material-expressive-react/dialog';
import { SecondaryTab, Tabs } from 'material-expressive-react/tabs';
import type { MdTabs } from '@material/web/tabs/tabs.js';
import { useEffect, useRef } from 'react';
import { Tooltips } from '../../shared/Tooltip';
import { t } from '../../shared/i18n';
import { DASHBOARD_TABS, useDashboard } from './useDashboard';

type MdTabsElement = MdTabs;

const WIKI_URL = 'https://github.com/gorhill/uBlock/wiki/Dashboard';

// The i18n product name split into the two-tone wordmark the fork draws.
function Wordmark() {
    const name = t('extName');
    const split = name.startsWith('uBlock') ? [ 'uBlock', name.slice(6) ] : [ name, '' ];
    return (
        <span className="productName" translate="no">
            <span>{split[0]}</span>
            {split[1] ? <span className="productName-accent">{split[1]}</span> : null}
        </span>
    );
}

export function App() {
    const iframe = useRef<HTMLIFrameElement>(null);
    const tabs = useRef<MdTabsElement>(null);
    const [ state, actions ] = useDashboard(iframe);

    const activeIndex = DASHBOARD_TABS.findIndex(tab => tab.pane === state.pane);

    // md-tabs owns keyboard navigation and roving tabindex; the selection is
    // driven from state so a refused switch snaps the strip back.
    useEffect(() => {
        const el = tabs.current;
        if ( el === null ) { return; }
        el.activeTabIndex = activeIndex;
    }, [ activeIndex, state.dialogOpen ]);

    const onTabsChange = (ev: Event) => {
        const el = ev.target as MdTabsElement;
        const tab = DASHBOARD_TABS[el.activeTabIndex];
        if ( tab === undefined ) { return; }
        if ( tab.pane === state.pane ) { return; }
        actions.selectPane(tab.pane);
        // Snap back until the pane actually loads (or the user ignores).
        if ( activeIndex !== -1 ) { el.activeTabIndex = activeIndex; }
    };

    return (
        <>
            <Toolbar
                id="dashboard-nav"
                className="ubv-nav"
                variant="Docked"
                dockPosition="Top"
                aria-label="uBlockVanced dashboard"
                hidden={state.noDashboard}
            >
                <div className="ubv-nav-main">
                    <TextButton className="brandCluster" href={WIKI_URL} target="_blank" data-tip={t('dashboardName')}>
                        <span className="logo"><img src="img/ublock.svg" alt={t('extName')} /></span>
                        <Wordmark />
                    </TextButton>
                    <Tabs ref={tabs} className="ubv-tabs" aria-label="Dashboard sections" onChange={onTabsChange}>
                        {DASHBOARD_TABS.map(tab => (
                            <SecondaryTab key={tab.pane} className="tabButton" data-pane={tab.pane} data-tip={t(tab.label)}>
                                {t(tab.label)}
                            </SecondaryTab>
                        ))}
                    </Tabs>
                </div>
            </Toolbar>

            <iframe
                id="iframe"
                ref={iframe}
                className={state.paneLoading ? 'paneLoading' : undefined}
                src="blank.html"
                title="Dashboard content"
            />

            <Dialog
                id="unsavedWarning"
                className="ubv-dialog"
                open={state.dialogOpen}
                onCancel={ev => { ev.preventDefault(); actions.stay(); }}
                aria-labelledby="unsavedWarningText"
            >
                <div slot="headline" id="unsavedWarningText">{t('dashboardUnsavedWarning')}</div>
                <div slot="actions" className="ubv-dialog-actions">
                    <TextButton autoFocus onClick={() => { actions.stay(); }}>{t('dashboardUnsavedWarningStay')}</TextButton>
                    <FilledButton onClick={() => { actions.ignore(); }}>{t('dashboardUnsavedWarningIgnore')}</FilledButton>
                </div>
            </Dialog>
            <Tooltips />
        </>
    );
}

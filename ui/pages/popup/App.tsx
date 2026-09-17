import { useEffect, useLayoutEffect, useRef } from 'react';
import { Firewall } from './components/Firewall';
import { PowerControl } from './components/PowerControl';
import { QuickTools } from './components/QuickTools';
import { RulesetTools } from './components/RulesetTools';
import { SiteSwitches } from './components/SiteSwitches';
import { UnprocessedWarning } from './components/UnprocessedWarning';
import { t } from '../../shared/i18n';
import { usePopup } from './usePopup';

// Body/root classes that upstream popup-fenix.css keys its layout on. They
// live outside the React root, so they are synced from state here.
function useBodyClasses(state: ReturnType<typeof usePopup>[0]) {
    const { data, loading, off, needReload, needSave, sectionsAttr, godMode, warn } = state;
    useLayoutEffect(() => {
        const body = document.body;
        body.dataset.more = sectionsAttr;
        body.classList.toggle('off', off);
        body.classList.toggle('needReload', needReload);
        body.classList.toggle('needSave', needSave);
        body.classList.toggle('godMode', godMode);
        body.classList.toggle('advancedUser', data?.advancedUserEnabled === true);
        body.classList.toggle('no-tooltips', data?.tooltipsDisabled === true);
        body.classList.toggle('vMin', data?.popupPanelHeightMode === 1);
        document.documentElement.classList.toggle('warn', warn);
        document.documentElement.classList.toggle('colorBlind', data?.colorBlindFriendly === true);
    }, [ data, off, needReload, needSave, sectionsAttr, godMode, warn ]);
    useEffect(() => {
        if ( loading ) { return; }
        document.body.classList.remove('loading');
    }, [ loading ]);
}

// Upstream syncPopupDensity(): shrink the panel when it would overflow.
function useDensity(dep: unknown) {
    const raf = useRef(0);
    useEffect(() => {
        const measure = () => {
            raf.current = 0;
            if ( document.documentElement.classList.contains('intab') ) { return; }
            const main = document.querySelector('#main');
            if ( main === null ) { return; }
            const body = document.body;
            body.classList.remove('compact', 'compactStats');
            const available = Math.max(0, self.innerHeight - 2);
            if ( available === 0 ) { return; }
            if ( main.getBoundingClientRect().height > available ) { body.classList.add('compact'); }
            if ( main.getBoundingClientRect().height > available ) { body.classList.add('compactStats'); }
        };
        const schedule = () => {
            if ( raf.current !== 0 ) { self.cancelAnimationFrame(raf.current); }
            raf.current = self.requestAnimationFrame(measure);
        };
        schedule();
        self.addEventListener('resize', schedule, { passive: true });
        return () => { self.removeEventListener('resize', schedule); };
    }, [ dep ]);
}

export function App() {
    const [ state, actions ] = usePopup();
    useBodyClasses(state);
    useDensity(state);

    // Keyboard: F5 / Ctrl+R reload (Shift bypasses cache); double-tap Ctrl
    // toggles god mode. Same as upstream.
    useEffect(() => {
        let ctrlCount = 0;
        let ctrlTime = 0;
        const onKeyDown = (ev: KeyboardEvent) => {
            if ( ev.isComposing ) { return; }
            if ( ev.key === 'Control' ) {
                if ( ev.repeat ) { return; }
                const now = Date.now();
                if ( now - ctrlTime >= 500 ) { ctrlCount = 0; }
                ctrlCount += 1;
                ctrlTime = now;
                if ( ctrlCount >= 2 ) { ctrlCount = 0; actions.toggleGodMode(); }
                return;
            }
            ctrlCount = 0;
            let bypassCache = false;
            switch ( ev.key ) {
            case 'F5':
                bypassCache = ev.ctrlKey || ev.metaKey || ev.shiftKey;
                break;
            case 'r':
                if ( (ev.ctrlKey || ev.metaKey) !== true ) { return; }
                break;
            case 'R':
                if ( (ev.ctrlKey || ev.metaKey) !== true ) { return; }
                bypassCache = true;
                break;
            default:
                return;
            }
            actions.reloadTab(bypassCache);
            ev.preventDefault();
            ev.stopPropagation();
        };
        document.addEventListener('keydown', onKeyDown, { capture: true });
        return () => { document.removeEventListener('keydown', onKeyDown, { capture: true }); };
    }, [ actions ]);

    const sticky = (
        <div id="sticky">
            <div id="stickyTools" className="ubv-sticky" role="toolbar" aria-label="Primary page controls">
                <RulesetTools state={state} actions={actions} side="start" />
                <PowerControl state={state} actions={actions} />
                <RulesetTools state={state} actions={actions} side="end" />
            </div>
        </div>
    );

    return (
        <div id="panes">
            {state.portrait ? sticky : null}
            <div id="main">
                {state.portrait ? null : sticky}
                <SiteSwitches state={state} actions={actions} />
                <QuickTools state={state} actions={actions} />
                <UnprocessedWarning state={state} actions={actions} />
                <hr data-more="f" />
                <div className="itemRibbon ubv-version" data-more="f">
                    <span>{t('popupVersion')}</span>
                    <span id="version">{state.data?.appVersion ?? ''}</span>
                </div>
            </div>
            <Firewall state={state} actions={actions} />
            <div id="firewall-vspacer"></div>
        </div>
    );
}

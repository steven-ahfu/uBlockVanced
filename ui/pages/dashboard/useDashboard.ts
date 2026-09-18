import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../shared/i18n';
import { send, storage } from '../../shared/vapi';

// The dashboard shell: tab strip, pane iframe, unsaved-changes guard.
// Same behaviour as upstream src/js/dashboard.js: readiness polling,
// dashboardConfig/noDashboard, hash routing, last-visited pane memory, and
// the pane's hasUnsavedData() consulted before every switch.

export interface DashboardTab { pane: string; label: string }

const NO_DASHBOARD = 'no-dashboard.html';

export const DASHBOARD_TABS: DashboardTab[] = [
    { pane: 'settings.html', label: 'settingsPageName' },
    { pane: '3p-filters.html', label: '3pPageName' },
    { pane: '1p-filters.html', label: '1pPageName' },
    { pane: 'dyna-rules.html', label: 'rulesPageName' },
    { pane: 'whitelist.html', label: 'whitelistPageName' },
    { pane: 'support.html', label: 'supportPageName' },
    { pane: 'about.html', label: 'aboutPageName' },
];

interface PaneWindow extends Window { hasUnsavedData?: () => boolean }

export interface DashboardState {
    ready: boolean;
    noDashboard: boolean;
    pane: string;
    paneLoading: boolean;
    dialogOpen: boolean;
}

export interface DashboardActions {
    /** Switch panes; asks the current pane about unsaved data first. */
    selectPane(pane: string): void;
    stay(): void;
    ignore(): void;
}

export function useDashboard(iframe: React.RefObject<HTMLIFrameElement | null>): [ DashboardState, DashboardActions ] {
    const [ ready, setReady ] = useState(false);
    const [ noDashboard, setNoDashboard ] = useState(self.location.hash.slice(1) === NO_DASHBOARD);
    const [ pane, setPane ] = useState('');
    const [ paneLoading, setPaneLoading ] = useState(false);
    const [ dialogOpen, setDialogOpen ] = useState(false);
    const paneRef = useRef(pane);
    paneRef.current = pane;
    const pending = useRef<string | null>(null);

    const hasUnsavedData = useCallback((): boolean => {
        const win = iframe.current?.contentWindow as PaneWindow | null | undefined;
        if ( !win || typeof win.hasUnsavedData !== 'function' ) { return false; }
        try { return win.hasUnsavedData() === true; } catch { return false; }
    }, [ iframe ]);

    const loadPane = useCallback((next: string) => {
        const frame = iframe.current;
        if ( frame === null ) { return; }
        self.location.replace(`#${next}`);
        setPane(next);
        const tab = DASHBOARD_TABS.find(tabItem => tabItem.pane === next);
        frame.title = tab ? t(tab.label) : 'Dashboard content';
        // Fade the pane out, swap, fade back in once loaded.
        setPaneLoading(true);
        frame.addEventListener('load', () => { setPaneLoading(false); }, { once: true });
        if ( frame.contentWindow ) {
            frame.contentWindow.location.replace(next);
        } else {
            frame.src = next;
        }
        if ( next !== NO_DASHBOARD ) {
            storage.set('dashboardLastVisitedPane', next);
        }
    }, [ iframe ]);

    const selectPane = useCallback((next: string) => {
        if ( next === '' || next === paneRef.current ) { return; }
        if ( hasUnsavedData() === false ) { loadPane(next); return; }
        pending.current = next;
        setDialogOpen(true);
    }, [ hasUnsavedData, loadPane ]);

    const stay = useCallback(() => {
        pending.current = null;
        setDialogOpen(false);
        // The URL hash may already point at the refused pane: restore it.
        if ( paneRef.current !== '' ) { self.location.replace(`#${paneRef.current}`); }
    }, []);

    const ignore = useCallback(() => {
        const next = pending.current;
        pending.current = null;
        setDialogOpen(false);
        if ( next !== null ) { loadPane(next); }
    }, [ loadPane ]);

    // Wait for the background to be ready, then pick the first pane.
    useEffect(() => {
        let disposed = false;
        let timer = 0;
        const check = async () => {
            try {
                const response = await send<boolean>('dashboard', { what: 'readyToFilter' });
                if ( disposed ) { return; }
                if ( response ) { onReady(); return; }
                const frame = iframe.current;
                if ( frame !== null && frame.src !== '' ) { frame.src = ''; }
            } catch {
                // keep polling
            }
            timer = self.setTimeout(check, 250);
        };
        const onReady = async () => {
            const [ config, last ] = await Promise.all([
                send<{ noDashboard?: boolean } | null>('dashboard', { what: 'dashboardConfig' }),
                storage.get<string>('dashboardLastVisitedPane'),
            ]);
            if ( disposed ) { return; }
            setReady(true);
            document.body.classList.remove('notReady');
            let first: string | null = typeof last === 'string' ? last : null;
            if ( config && config.noDashboard ) {
                self.location.hash = `#${NO_DASHBOARD}`;
                setNoDashboard(true);
            } else if ( self.location.hash === `#${NO_DASHBOARD}` ) {
                self.location.hash = '';
            }
            if ( self.location.hash !== '' ) {
                first = self.location.hash.slice(1) || null;
            }
            loadPane(first !== null ? first : 'settings.html');
        };
        check();
        return () => { disposed = true; self.clearTimeout(timer); };
    }, [ iframe, loadPane ]);

    // Hash routing after load, and the unsaved-data guard on unload.
    useEffect(() => {
        if ( ready === false ) { return; }
        const onHash = () => {
            const next = self.location.hash.slice(1);
            if ( next === '' ) { return; }
            selectPane(next);
        };
        const onBeforeUnload = (ev: BeforeUnloadEvent) => {
            if ( hasUnsavedData() === false ) { return; }
            ev.preventDefault();
            ev.returnValue = '';
        };
        self.addEventListener('hashchange', onHash);
        self.addEventListener('beforeunload', onBeforeUnload);
        return () => {
            self.removeEventListener('hashchange', onHash);
            self.removeEventListener('beforeunload', onBeforeUnload);
        };
    }, [ ready, selectPane, hasUnsavedData ]);

    useEffect(() => {
        document.body.classList.toggle('noDashboard', noDashboard);
    }, [ noDashboard ]);

    return [ { ready, noDashboard, pane, paneLoading, dialogOpen }, { selectPane, stay, ignore } ];
}

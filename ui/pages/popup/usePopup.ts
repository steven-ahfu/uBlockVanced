// Popup state and actions. Every message sent here is one the upstream
// popup-fenix.js already sends, so src/js/messaging.js is unchanged.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { closePopup, isMobile, send, storage } from '../../shared/vapi';
import {
    buildFirewallModel, computedSections, defaultFilterExpressions,
    filterExpressionsFromStorage, filterExpressionsToStorage, nextSectionBits,
    popupHash, sanitizeSectionBits, sectionBitsToAttribute, sectionFirewallBit,
    sectionsMinMax,
} from './model';
import type { FilterExpressions, PopupData, RuleAction, RuleScope, SwitchName } from './types';

const popupPanel = <T = unknown>(msg: Record<string, unknown> & { what: string }) =>
    send<T>('popupPanel', msg);

function normalize(raw: unknown): PopupData | null {
    if ( typeof raw !== 'object' || raw === null ) { return null; }
    const data = raw as PopupData;
    data.cnameMap = new Map(data.cnameMap instanceof Map ? data.cnameMap : (data.cnameMap || []));
    data.firewallRules = data.firewallRules || {};
    data.hostnameDict = data.hostnameDict || {};
    return data;
}

export interface PopupState {
    data: PopupData | null;
    loading: boolean;
    off: boolean;
    needReload: boolean;
    needSave: boolean;
    sections: number;
    sectionsAttr: string;
    canMore: boolean;
    canLess: boolean;
    expanded: boolean;
    expandExceptions: Set<string>;
    filters: FilterExpressions;
    godMode: boolean;
    portrait: boolean;
    scriptCount: number;
    hiddenCount: number | null; // null = not fetched yet, -1 = unknown
    hiddenBusy: boolean;
    warn: boolean;
    firewall: ReturnType<typeof buildFirewallModel> | null;
    canPick: boolean;
}

export interface PopupActions {
    togglePower(ev: { ctrlKey: boolean; metaKey: boolean }): void;
    toggleSwitch(name: SwitchName, persist: boolean): Promise<void>;
    setRule(scope: RuleScope, des: string, type: string, action: RuleAction, persist: boolean): Promise<void>;
    saveRules(): void;
    revertRules(): Promise<void>;
    reloadTab(bypassCache: boolean): void;
    gotoPick(): void;
    gotoURL(url: string, shiftKey: boolean): void;
    toggleSections(more: boolean): void;
    setGlobalExpand(state: boolean): void;
    setSpecificExpand(domain: string, state: boolean): void;
    openInTab(): void;
    setFilters(next: FilterExpressions): void;
    dismissWarning(): void;
    fetchHiddenCount(): void;
    toggleGodMode(): void;
}

export function usePopup(): [ PopupState, PopupActions ] {
    const selfURL = useMemo(() => new URL(self.location.href), []);
    const tabIdParam = useMemo(() => parseInt(selfURL.searchParams.get('tabId') || '', 10) || null, [ selfURL ]);

    const [ data, setData ] = useState<PopupData | null>(null);
    const [ loading, setLoading ] = useState(true);
    const [ off, setOff ] = useState(false);
    const [ needReload, setNeedReload ] = useState(false);
    const [ needSave, setNeedSave ] = useState(false);
    const [ sections, setSectionsState ] = useState<number>(0b100);
    const [ expanded, setExpanded ] = useState(false);
    const [ expandExceptions, setExpandExceptions ] = useState<Set<string>>(() => new Set());
    const [ filters, setFiltersState ] = useState<FilterExpressions>(defaultFilterExpressions);
    const [ godMode, setGodMode ] = useState(false);
    const [ portrait, setPortrait ] = useState(false);
    const [ scriptCount, setScriptCount ] = useState(0);
    const [ hiddenCount, setHiddenCount ] = useState<number | null>(null);
    const [ hiddenBusy, setHiddenBusy ] = useState(false);
    const [ warn, setWarn ] = useState(false);

    const dataRef = useRef<PopupData | null>(null);
    const offRef = useRef(false);
    const cachedHashRef = useRef('');
    const forceReloadRef = useRef(0);
    const renderedOnceRef = useRef(false);
    const pollTimerRef = useRef<{ on(ms: number): void; off(): void } | null>(null);
    const hiddenDirtyRef = useRef(true);

    dataRef.current = data;
    offRef.current = off;

    const applyHash = useCallback((next: PopupData, nextOff: boolean, reset = false) => {
        if ( next.pageHostname === 'behind-the-scene' ) {
            setNeedReload(false);
            return;
        }
        const hash = popupHash(next, nextOff);
        if ( reset ) {
            cachedHashRef.current = hash;
            forceReloadRef.current = 0;
        }
        setNeedReload(hash !== cachedHashRef.current || next.hasUnprocessedRequest === true);
    }, []);

    const applyData = useCallback((raw: unknown, first = false) => {
        const next = normalize(raw);
        if ( next === null ) { return; }
        const nextOff = next.pageURL === '' || next.netFilteringSwitch !== true;
        setData(next);
        setOff(nextOff);
        setNeedSave(next.matrixIsDirty === true);
        setWarn(next.hasUnprocessedRequest === true);
        if ( renderedOnceRef.current === false ) {
            renderedOnceRef.current = true;
            setSectionsState(computedSections(next));
            setGodMode(next.godMode === true);
            setExpanded(next.firewallPaneMinimized === false);
        }
        applyHash(next, nextOff, first);
    }, [ applyHash ]);

    // Polling for content changes, as upstream does.
    const poll = useCallback(() => {
        pollTimerRef.current?.on(1500);
    }, []);

    const getPopupData = useCallback(async (tabId: number | null, first = false) => {
        const response = await popupPanel({ what: 'getPopupData', tabId });
        applyData(response, first);
        hiddenDirtyRef.current = true;
        const count = await popupPanel<number>({
            what: 'getScriptCount',
            tabId: (response as PopupData)?.tabId,
        });
        setScriptCount(count || 0);
        poll();
    }, [ applyData, poll ]);

    useEffect(() => {
        pollTimerRef.current = vAPI.defer.create(async () => {
            const current = dataRef.current;
            if ( current === null ) { return; }
            const changed = await popupPanel<boolean>({
                what: 'hasPopupContentChanged',
                tabId: current.tabId,
                contentLastModified: current.contentLastModified,
            });
            if ( changed ) {
                await getPopupData(current.tabId);
                return;
            }
            poll();
        });
        return () => { pollTimerRef.current?.off(); };
    }, [ getPopupData, poll ]);

    // Restore persisted UI state early, then load data.
    useEffect(() => {
        storage.get<number>('popupPanelSections').then(bits => {
            if ( typeof bits === 'number' && renderedOnceRef.current === false ) {
                setSectionsState(sanitizeSectionBits(bits));
            }
        });
        storage.get<string[]>('popupExpandExceptions').then(list => {
            if ( Array.isArray(list) ) { setExpandExceptions(new Set(list)); }
        });
        storage.get<string>('firewallFilters').then(v => {
            const f = filterExpressionsFromStorage(v);
            if ( f !== null ) { setFiltersState(f); }
        });
        storage.get<string>('popupFontSize').then(value => {
            if ( typeof value === 'string' && value !== 'unset' ) {
                document.body.style.setProperty('--font-size', value);
            }
        });
        getPopupData(tabIdParam, true)
            .catch(() => { /* background starting up or tab closed */ })
            .finally(() => setLoading(false));
    }, [ getPopupData, tabIdParam ]);

    // One-time settings once data is known.
    useEffect(() => {
        if ( data === null ) { return; }
        if ( data.tabTitle ) { document.title = data.appName + ' - ' + data.tabTitle; }
        if ( data.fontSize && data.fontSize !== 'unset' ) {
            document.body.style.setProperty('--font-size', data.fontSize);
            storage.set('popupFontSize', data.fontSize);
        } else if ( data.fontSize === 'unset' ) {
            document.body.style.removeProperty('--font-size');
            storage.remove('popupFontSize');
        }
        if ( data.uiPopupConfig !== undefined ) {
            document.body.setAttribute('data-ui', data.uiPopupConfig);
        }
    }, [ data ]);

    // Orientation, as upstream's setOrientation().
    useEffect(() => {
        if ( data === null ) { return; }
        const root = document.documentElement.classList;
        const goPortrait = () => { root.remove('desktop'); root.add('portrait'); setPortrait(true); };
        if ( root.contains('mobile') || selfURL.searchParams.get('portrait') !== null ) { goPortrait(); return; }
        if ( data.popupPanelOrientation === 'landscape' ) { return; }
        if ( data.popupPanelOrientation === 'portrait' ) { goPortrait(); return; }
        if ( root.contains('desktop') === false ) { return; }
        let cancelled = false;
        let frames = 8;
        const tick = () => {
            if ( cancelled ) { return; }
            if ( frames-- > 0 ) { self.requestAnimationFrame(tick); return; }
            const main = document.querySelector('#main') as HTMLElement | null;
            const firewall = document.querySelector('#firewall') as HTMLElement | null;
            if ( main === null || firewall === null ) { return; }
            const minWidth = (main.offsetWidth + firewall.offsetWidth) / 1.1;
            if ( window.innerWidth < minWidth ) { goPortrait(); }
        };
        self.requestAnimationFrame(tick);
        return () => { cancelled = true; };
    }, [ data === null, selfURL ]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if ( selfURL.searchParams.get('intab') !== null ) {
            document.documentElement.classList.add('intab');
        }
    }, [ selfURL ]);

    /**************************************************************************/

    const setSections = useCallback((bits: number) => {
        setSectionsState(sanitizeSectionBits(bits));
    }, []);

    const actions: PopupActions = useMemo(() => ({
        togglePower(ev) {
            const current = dataRef.current;
            if ( current === null || current.pageURL === '' ) { return; }
            const nextOff = !offRef.current;
            setOff(nextOff);
            popupPanel({
                what: 'toggleNetFiltering',
                url: current.pageURL,
                scope: ev.ctrlKey || ev.metaKey ? 'page' : '',
                state: !nextOff,
                tabId: current.tabId,
            });
            applyHash(current, nextOff);
        },
        async toggleSwitch(name, persist) {
            const current = dataRef.current;
            if ( current === null ) { return; }
            if ( isMobile() && name === 'no-cosmetic-filtering' && hiddenBusy ) { return; }
            const key = {
                'no-popups': 'noPopups',
                'no-large-media': 'noLargeMedia',
                'no-cosmetic-filtering': 'noCosmeticFiltering',
                'no-remote-fonts': 'noRemoteFonts',
                'no-scripting': 'noScripting',
            }[name] as keyof PopupData;
            const nextState = current[key] !== true;
            setData({ ...current, [key]: nextState });
            const response = await popupPanel({
                what: 'toggleHostnameSwitch',
                name,
                hostname: current.pageHostname,
                state: nextState,
                tabId: current.tabId,
                persist,
            });
            if ( name === 'no-scripting' ) { forceReloadRef.current ^= 1; }
            const next = normalize(response);
            if ( next === null ) { return; }
            setData(next);
            setNeedSave(next.matrixIsDirty === true);
            applyHash(next, offRef.current);
        },
        async setRule(scope, des, type, action, persist) {
            const current = dataRef.current;
            if ( current === null || typeof current.pageHostname !== 'string' || current.pageHostname === '' ) { return; }
            const response = await popupPanel({
                what: 'toggleFirewallRule',
                tabId: current.tabId,
                pageHostname: current.pageHostname,
                srcHostname: scope === '/' ? '*' : current.pageHostname,
                desHostname: des,
                requestType: type,
                action,
                persist,
            });
            const next = normalize(response);
            if ( next === null ) { return; }
            setData(next);
            setNeedSave(next.matrixIsDirty === true);
            applyHash(next, offRef.current);
        },
        saveRules() {
            const current = dataRef.current;
            if ( current === null ) { return; }
            popupPanel({
                what: 'saveFirewallRules',
                srcHostname: current.pageHostname,
                desHostnames: current.hostnameDict,
            });
            setNeedSave(false);
        },
        async revertRules() {
            const current = dataRef.current;
            if ( current === null ) { return; }
            setNeedSave(false);
            const response = await popupPanel({
                what: 'revertFirewallRules',
                srcHostname: current.pageHostname,
                desHostnames: current.hostnameDict,
                tabId: current.tabId,
            });
            const next = normalize(response);
            if ( next === null ) { return; }
            setData(next);
            applyHash(next, offRef.current);
        },
        reloadTab(bypassCache) {
            const current = dataRef.current;
            if ( current === null ) { return; }
            if ( current.hasUnprocessedRequest === true ) {
                popupPanel({ what: 'dismissUnprocessedRequest', tabId: current.tabId }).then(() => {
                    setWarn(false);
                });
            }
            popupPanel({
                what: 'reloadTab',
                tabId: current.tabId,
                url: current.rawURL,
                select: isMobile(),
                bypassCache: bypassCache || forceReloadRef.current !== 0,
            });
            current.contentLastModified = -1;
            applyHash(current, offRef.current, true);
        },
        gotoPick() {
            const current = dataRef.current;
            if ( current === null ) { return; }
            popupPanel({ what: 'launchElementPicker', tabId: current.tabId });
            closePopup();
        },
        gotoURL(url, shiftKey) {
            const current = dataRef.current;
            if ( url === 'logger-ui.html#_' && typeof current?.tabId === 'number' ) {
                url += '+' + current.tabId;
            }
            popupPanel({
                what: 'gotoURL',
                details: { url, select: true, index: -1, shiftKey },
            });
            closePopup();
        },
        toggleSections(more) {
            const current = dataRef.current;
            setSectionsState(prev => {
                const newBits = nextSectionBits(current, prev, more);
                if ( newBits === prev ) { return prev; }
                if ( current !== null ) { current.popupPanelSections = newBits; }
                popupPanel({ what: 'userSettings', name: 'popupPanelSections', value: newBits });
                storage.set('popupPanelSections', newBits);
                return newBits;
            });
        },
        setGlobalExpand(state) {
            setExpanded(state);
            setExpandExceptions(new Set());
            storage.set('popupExpandExceptions', []);
            const current = dataRef.current;
            if ( current !== null ) { current.firewallPaneMinimized = !state; }
            popupPanel({ what: 'userSettings', name: 'firewallPaneMinimized', value: !state });
        },
        setSpecificExpand(domain, state) {
            setExpandExceptions(prev => {
                const next = new Set(prev);
                if ( state ) { next.add(domain); } else { next.delete(domain); }
                storage.set('popupExpandExceptions', Array.from(next));
                return next;
            });
        },
        openInTab() {
            const current = dataRef.current;
            if ( current === null ) { return; }
            popupPanel({
                what: 'gotoURL',
                details: { url: `popup-fenix.html?tabId=${current.tabId}&intab=1`, select: true, index: -1 },
            });
            closePopup();
        },
        setFilters(next) {
            setFiltersState(next);
            storage.set('firewallFilters', filterExpressionsToStorage(next));
        },
        dismissWarning() {
            const current = dataRef.current;
            if ( current === null ) { return; }
            popupPanel({ what: 'dismissUnprocessedRequest', tabId: current.tabId }).then(() => {
                current.hasUnprocessedRequest = false;
                setWarn(false);
            });
        },
        fetchHiddenCount() {
            const current = dataRef.current;
            if ( current === null || hiddenDirtyRef.current === false ) { return; }
            hiddenDirtyRef.current = false;
            setHiddenBusy(true);
            popupPanel<number>({ what: 'getHiddenElementCount', tabId: current.tabId }).then(count => {
                setHiddenCount(count ?? 0);
                setHiddenBusy(false);
            });
        },
        toggleGodMode() { setGodMode(v => !v); },
    }), [ applyHash, hiddenBusy ]);

    /**************************************************************************/

    const firewall = useMemo(() => data === null ? null : buildFirewallModel(data), [ data ]);
    const sectionsAttr = sectionBitsToAttribute(sections);
    const { min, max } = sectionsMinMax(data);
    const canPick = data !== null && data.canElementPicker === true && !off && data.userFiltersAreEnabled === true;

    const state: PopupState = {
        data, loading, off, needReload, needSave,
        sections, sectionsAttr,
        canMore: sectionsAttr !== max,
        canLess: sectionsAttr !== min,
        expanded, expandExceptions, filters, godMode, portrait,
        scriptCount, hiddenCount, hiddenBusy, warn, firewall, canPick,
    };
    void setSections;
    void sectionFirewallBit;
    return [ state, actions ];
}

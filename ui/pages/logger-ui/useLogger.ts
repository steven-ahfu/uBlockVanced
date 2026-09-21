// uBlockVanced - the logger engine as a React hook.
//
// Same protocol as src/js/logger-ui.js: the same `loggerUI` messages, the same
// 1.2s poll, the same `#<selector>` URL hash, the same row janitor and the same
// `loggerSettings` key in vAPI.localStorage. The mutable engine lives in a ref
// (entries are unshifted, exactly as upstream does) and a revision counter
// drives rendering, so the hot path allocates no more than upstream's did.

import {
    type FiltexState,
    LOGGER_SETTINGS_KEY,
    LogEntry,
    type LogEntryDetails,
    type LoggerSettings,
    type RowFilter,
    builtinFilters,
    createLogSeparator,
    defaultFiltexState,
    defaultSettings,
    filterOne,
    mergeStoredSettings,
    parseLogEntry,
    userFilters,
} from './model';
import { send, storage } from '../../shared/vapi';
import { useCallback, useEffect, useReducer, useRef } from 'react';

/******************************************************************************/

interface IdleDeadlineLike { timeRemaining(): number }
interface IdleScheduler {
    requestIdleCallback(cb: (deadline: IdleDeadlineLike) => void, options?: { timeout: number }): number;
    cancelIdleCallback(handle: number): void;
}
const idle = self as unknown as IdleScheduler;

interface ReadAllResponse {
    unavailable?: boolean;
    tooltips?: boolean;
    activeTabId?: number;
    tabIds?: Array<[ number, string ]>;
    tabIdsToken?: unknown;
    entries?: string[];
    colorBlind?: boolean;
}

interface PopupBox { x: number; y: number; w: number; h: number }

interface Engine {
    entries: LogEntry[];
    filtered: LogEntry[];
    voided: number;
    allTabIds: Map<number, string>;
    tabOptions: Array<[ number, string ]>;
    allTabIdsToken: unknown;
    activeTabId: number;
    selectedTabId: number;
    lastSelectedTabId: number | undefined;
    lastHash: string | undefined;
    pageSelector: string;
    paused: boolean;
    masterFilter: boolean;
    filterInput: string;
    filtex: FiltexState;
    filters: RowFilter[];
    cnameSeen: boolean;
    settings: LoggerSettings;
    tooltips: boolean;
    vExpanded: boolean;
    consoleOn: boolean;
    verbose: boolean;
    popupTabId: number;
    ownerId: number | undefined;
    popupBox: PopupBox | undefined;
    janitorIndex: number;
}

export interface LoggerSnapshot {
    revision: number;
    rows: LogEntry[];
    entries: LogEntry[];
    voidedCount: number;
    tabOptions: Array<[ number, string ]>;
    activeTabId: number;
    selectedTabId: number;
    pageSelector: string;
    paused: boolean;
    masterFilter: boolean;
    filterInput: string;
    filtex: FiltexState;
    filterCount: number;
    cnameSeen: boolean;
    settings: LoggerSettings;
    tooltips: boolean;
    vExpanded: boolean;
    consoleOn: boolean;
    verbose: boolean;
    popupTabId: number;
}

export interface LoggerActions {
    selectPage(value: string): void;
    reloadTab(bypassCache: boolean): void;
    togglePause(): void;
    clean(): void;
    clear(): void;
    setFilterInput(value: string): void;
    toggleMasterFilter(): void;
    toggleFiltex(filtex: string): void;
    toggleFiltexNot(groupId: string): void;
    resetFiltex(): void;
    applySettings(next: LoggerSettings, persist: boolean): void;
    toggleVExpanded(): void;
    toggleConsole(): void;
    toggleVerbose(): void;
    clearConsole(ids: number[]): void;
    togglePopup(): void;
    tabIdFromPageSelector(): number;
}

/******************************************************************************/

const POLL_PERIOD = 1200;
const FILTER_DEBOUNCE = 750;

function broadcastUBO(message: Record<string, unknown>): void {
    const bc = new BroadcastChannel('uBO');
    bc.postMessage(message);
    bc.close();
}

function newEngine(): Engine {
    // The built-in row filters are live before the very first poll, exactly
    // as upstream's rowFilterer is when readLogBuffer() first runs.
    const filtex = defaultFiltexState();
    return {
        entries: [],
        filtered: [],
        voided: 0,
        allTabIds: new Map(),
        tabOptions: [],
        allTabIdsToken: undefined,
        activeTabId: 0,
        selectedTabId: 0,
        lastSelectedTabId: undefined,
        lastHash: undefined,
        pageSelector: '0',
        paused: false,
        masterFilter: true,
        filterInput: '',
        filtex,
        filters: builtinFilters(filtex),
        cnameSeen: false,
        settings: defaultSettings(),
        tooltips: true,
        vExpanded: false,
        consoleOn: false,
        verbose: false,
        popupTabId: 0,
        ownerId: Date.now(),
        popupBox: undefined,
        janitorIndex: 0,
    };
}

/******************************************************************************/

export function useLogger(): [ LoggerSnapshot, LoggerActions ] {
    const engRef = useRef<Engine | null>(null);
    if ( engRef.current === null ) { engRef.current = newEngine(); }
    const eng = engRef.current as Engine;
    const [ revision, bump ] = useReducer((n: number) => n + 1, 0);
    const filterTimer = useRef(0);

    /**************************************************************************/

    const filterAll = useCallback(() => {
        const filtered: LogEntry[] = [];
        let voided = 0;
        for ( const entry of eng.entries ) {
            if ( filterOne(entry, eng.selectedTabId, eng.masterFilter, eng.filters) === false ) { continue; }
            filtered.push(entry);
            if ( entry.voided ) { voided += 1; }
        }
        eng.filtered = filtered;
        eng.voided = voided;
    }, [ eng ]);

    const recomputeFilters = useCallback(() => {
        eng.filters = builtinFilters(eng.filtex).concat(userFilters(eng.filterInput));
    }, [ eng ]);

    /**************************************************************************/

    const pageSelectorFromURLHash = useCallback(() => {
        let hash = self.location.hash.slice(1);
        const match = /^([^+]+)\+(.+)$/.exec(hash);
        if ( match !== null ) {
            hash = match[1];
            eng.activeTabId = parseInt(match[2], 10) || 0;
            self.location.hash = '#' + hash;
        }
        if ( hash !== eng.lastHash ) {
            const known = hash === '0' || hash === '-1' || hash === '_' ||
                eng.allTabIds.has(parseInt(hash, 10));
            if ( known === false ) { hash = '0'; }
            eng.pageSelector = hash;
            eng.lastHash = hash;
        }
        eng.selectedTabId = hash === '_' ? eng.activeTabId : (parseInt(hash, 10) || 0);
        if ( eng.lastSelectedTabId === eng.selectedTabId ) { return; }
        filterAll();
        eng.lastSelectedTabId = eng.selectedTabId;
        // The retained DOM inspector listens for this event.
        document.dispatchEvent(new Event('tabIdChanged'));
    }, [ eng, filterAll ]);

    const synchronizeTabIds = useCallback((newTabIds: Map<number, string>) => {
        const toVoid = new Set<number>();
        for ( const tabId of eng.allTabIds.keys() ) {
            if ( newTabIds.has(tabId) ) { continue; }
            toVoid.add(tabId);
        }
        eng.allTabIds = newTabIds;

        // A voided entry gets a fresh identity so identity-based associations
        // elsewhere are invalidated -- the same trick upstream uses.
        if ( toVoid.size !== 0 ) {
            const autoDeleteVoidedRows = eng.pageSelector === '_';
            let rowVoided = false;
            for ( let i = 0; i < eng.entries.length; i++ ) {
                const entry = eng.entries[i];
                if ( entry.tabId === undefined ) { continue; }
                if ( toVoid.has(entry.tabId) === false ) { continue; }
                if ( entry.voided ) { continue; }
                entry.voided = true;
                rowVoided = true;
                if ( autoDeleteVoidedRows ) { entry.dead = true; }
                eng.entries[i] = new LogEntry(entry);
            }
            if ( rowVoided ) { filterAll(); }
        }

        if ( eng.popupTabId !== 0 && toVoid.has(eng.popupTabId) ) { eng.popupTabId = 0; }

        const ids = Array.from(newTabIds.keys()).filter(id => id > 0).sort((a, b) =>
            (newTabIds.get(a) ?? '').localeCompare(newTabIds.get(b) ?? '')
        );
        eng.tabOptions = ids.map(id => [ id, (newTabIds.get(id) ?? '').slice(0, 80) ] as [ number, string ]);

        const sel = eng.pageSelector;
        if ( sel !== '0' && sel !== '-1' && sel !== '_' && newTabIds.has(parseInt(sel, 10)) === false ) {
            eng.lastHash = undefined;
            self.location.replace('#0');
        }
        pageSelectorFromURLHash();
    }, [ eng, filterAll, pageSelectorFromURLHash ]);

    /**************************************************************************/

    const processLoggerEntries = useCallback((entries: string[]) => {
        if ( entries.length === 0 ) { return; }
        const autoDeleteVoidedRows = eng.pageSelector === '_';
        const added: LogEntry[] = [];
        let inserted = 0;

        for ( const raw of entries ) {
            let unboxed: LogEntryDetails;
            try {
                unboxed = JSON.parse(raw) as LogEntryDetails;
            } catch {
                continue;
            }
            if ( eng.paused ) { continue; }
            const parsed = parseLogEntry(unboxed);
            if ( parsed.tabId !== undefined && eng.allTabIds.has(parsed.tabId) === false ) {
                if ( autoDeleteVoidedRows ) { continue; }
                parsed.voided = true;
            }
            if (
                parsed.type === 'main_frame' &&
                parsed.aliased === false && (
                    parsed.filter === undefined ||
                    parsed.filter.modifier !== true && parsed.filter.source !== 'redirect'
                )
            ) {
                const separator = createLogSeparator(parsed, unboxed.url ?? '');
                eng.entries.unshift(separator);
                inserted += 1;
                if ( filterOne(separator, eng.selectedTabId, eng.masterFilter, eng.filters) ) {
                    added.unshift(separator);
                    if ( separator.voided ) { eng.voided += 1; }
                }
            }
            if ( eng.cnameSeen === false && parsed.aliased ) { eng.cnameSeen = true; }
            eng.entries.unshift(parsed);
            inserted += 1;
            if ( filterOne(parsed, eng.selectedTabId, eng.masterFilter, eng.filters) ) {
                added.unshift(parsed);
                if ( parsed.voided ) { eng.voided += 1; }
            }
        }

        if ( eng.janitorIndex !== 0 ) { eng.janitorIndex += inserted; }
        if ( added.length === 0 ) { return; }
        eng.filtered = added.concat(eng.filtered);
    }, [ eng ]);

    /**************************************************************************/

    // Poll the background exactly the way upstream's readLogBuffer() does.
    useEffect(() => {
        let stopped = false;
        let timer = 0;
        let reading = false;

        const readNow = async () => {
            if ( stopped ) { return; }
            if ( eng.ownerId === undefined ) { return; }
            if ( reading ) { return; }
            reading = true;
            const msg: Record<string, unknown> & { what: string } = {
                what: 'readAll',
                ownerId: eng.ownerId,
                tabIdsToken: eng.allTabIdsToken,
            };
            // Detect a moved/resized detached logger window.
            if (
                eng.popupBox !== undefined && (
                    self.screenX !== eng.popupBox.x ||
                    self.screenY !== eng.popupBox.y ||
                    self.outerWidth !== eng.popupBox.w ||
                    self.outerHeight !== eng.popupBox.h
                )
            ) {
                eng.popupBox.x = self.screenX;
                eng.popupBox.y = self.screenY;
                eng.popupBox.w = self.outerWidth;
                eng.popupBox.h = self.outerHeight;
                msg.popupLoggerBoxChanged = true;
            }
            let response: ReadAllResponse | undefined;
            try {
                response = await send<ReadAllResponse>('loggerUI', msg);
            } catch {
                response = undefined;
            }
            reading = false;
            if ( stopped ) { return; }
            if ( response !== undefined && response.unavailable !== true ) {
                if ( eng.tooltips && response.tooltips === false ) { eng.tooltips = false; }
                let activeTabIdChanged = false;
                if ( response.activeTabId ) {
                    activeTabIdChanged = response.activeTabId !== eng.activeTabId;
                    eng.activeTabId = response.activeTabId;
                }
                if ( Array.isArray(response.tabIds) ) {
                    synchronizeTabIds(new Map(response.tabIds));
                    eng.allTabIdsToken = response.tabIdsToken;
                }
                if ( activeTabIdChanged ) { pageSelectorFromURLHash(); }
                processLoggerEntries(response.entries ?? []);
                document.documentElement.classList.toggle('colorBlind', response.colorBlind === true);
                bump();
            }
            timer = self.setTimeout(() => { void readNow(); }, POLL_PERIOD);
        };

        void readNow();
        return () => {
            stopped = true;
            self.clearTimeout(timer);
        };
    }, [ eng, pageSelectorFromURLHash, processLoggerEntries, synchronizeTabIds ]);

    /**************************************************************************/

    // Row janitor: discard entries failing any of the three user limits.
    useEffect(() => {
        let handle = 0;
        let timer = 0;
        let stopped = false;
        const tabIdToDiscard = new Set<number>();
        const tabIdToLoadCountMap = new Map<number, number>();
        const tabIdToEntryCountMap = new Map<number, number>();

        const discard = (deadline: IdleDeadlineLike) => {
            const opts = eng.settings.discard;
            const maxLoadCount = opts.maxLoadCount;
            const maxEntryCount = opts.maxEntryCount;
            const obsolete = opts.maxAge !== 0 ? Date.now() / 1000 - opts.maxAge * 60 : 0;

            let i = eng.janitorIndex;
            if ( i >= eng.entries.length ) { i = 0; }
            if ( i === 0 ) {
                tabIdToDiscard.clear();
                tabIdToLoadCountMap.clear();
                tabIdToEntryCountMap.clear();
            }

            let idel = -1;
            let bufferedTabId = 0;
            let bufferedEntryCount = 0;
            let modified = false;

            while ( i < eng.entries.length ) {
                if ( i % 64 === 0 && deadline.timeRemaining() === 0 ) { break; }
                const entry = eng.entries[i];
                const tabId = entry.tabId || 0;
                if ( entry.dead || tabIdToDiscard.has(tabId) ) {
                    if ( idel === -1 ) { idel = i; }
                    i += 1;
                    continue;
                }
                if ( maxLoadCount !== 0 && entry.type === 'tabLoad' ) {
                    const count = (tabIdToLoadCountMap.get(tabId) || 0) + 1;
                    tabIdToLoadCountMap.set(tabId, count);
                    if ( count >= maxLoadCount ) { tabIdToDiscard.add(tabId); }
                }
                if ( maxEntryCount !== 0 ) {
                    if ( bufferedTabId !== tabId ) {
                        if ( bufferedEntryCount !== 0 ) {
                            tabIdToEntryCountMap.set(bufferedTabId, bufferedEntryCount);
                        }
                        bufferedTabId = tabId;
                        bufferedEntryCount = tabIdToEntryCountMap.get(tabId) || 0;
                    }
                    bufferedEntryCount += 1;
                    if ( bufferedEntryCount >= maxEntryCount ) { tabIdToDiscard.add(bufferedTabId); }
                }
                // Entries are chronological: everything past `obsolete` goes.
                if ( obsolete !== 0 && entry.tstamp <= obsolete ) {
                    if ( idel === -1 ) { idel = i; }
                    break;
                }
                if ( idel !== -1 ) {
                    eng.entries.copyWithin(idel, i);
                    eng.entries.length -= i - idel;
                    i = idel;
                    idel = -1;
                    modified = true;
                }
                i += 1;
            }

            if ( idel !== -1 ) {
                eng.entries.length = idel;
                modified = true;
            }
            if ( i >= eng.entries.length ) { i = 0; }
            eng.janitorIndex = i;
            if ( eng.janitorIndex === 0 ) {
                tabIdToDiscard.clear();
                tabIdToLoadCountMap.clear();
                tabIdToEntryCountMap.clear();
            }
            if ( modified === false ) { return; }
            filterAll();
            bump();
        };

        const schedule = () => {
            if ( stopped ) { return; }
            handle = idle.requestIdleCallback(deadline => {
                handle = 0;
                discard(deadline);
                timer = self.setTimeout(schedule, 1889);
            }, { timeout: 2000 });
        };
        timer = self.setTimeout(schedule, 1889);

        return () => {
            stopped = true;
            self.clearTimeout(timer);
            if ( handle !== 0 ) { idle.cancelIdleCallback(handle); }
        };
    }, [ eng, filterAll ]);

    /**************************************************************************/

    // Stored settings, page-hash sync, view ownership, reload shortcuts.
    useEffect(() => {
        void storage.get(LOGGER_SETTINGS_KEY).then(value => {
            eng.settings = mergeStoredSettings(value);
            bump();
        });

        recomputeFilters();
        filterAll();
        pageSelectorFromURLHash();
        bump();

        const onHashChange = () => { pageSelectorFromURLHash(); bump(); };
        self.addEventListener('hashchange', onHashChange);

        const releaseView = () => {
            if ( eng.ownerId === undefined ) { return; }
            void send('loggerUI', { what: 'releaseView', ownerId: eng.ownerId });
            eng.ownerId = undefined;
        };
        const grabView = () => {
            if ( eng.ownerId === undefined ) { eng.ownerId = Date.now(); }
        };
        self.addEventListener('pagehide', releaseView);
        self.addEventListener('pageshow', grabView);
        self.addEventListener('beforeunload', releaseView);

        const onKeyDown = (ev: KeyboardEvent) => {
            if ( ev.isComposing ) { return; }
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
            const tabId = eng.pageSelector !== '_'
                ? (parseInt(eng.pageSelector, 10) || 0)
                : eng.activeTabId;
            if ( tabId > 0 ) {
                void send('loggerUI', { what: 'reloadTab', tabId, bypassCache });
            }
            ev.preventDefault();
            ev.stopPropagation();
        };
        document.addEventListener('keydown', onKeyDown, { capture: true });

        // Watch the detached logger window's geometry, 2s after load.
        let geometryTimer = 0;
        if ( self.location.search.includes('popup=1') ) {
            geometryTimer = self.setTimeout(() => {
                eng.popupBox = {
                    x: self.screenX, y: self.screenY,
                    w: self.outerWidth, h: self.outerHeight,
                };
            }, 2000);
        }

        return () => {
            self.removeEventListener('hashchange', onHashChange);
            self.removeEventListener('pagehide', releaseView);
            self.removeEventListener('pageshow', grabView);
            self.removeEventListener('beforeunload', releaseView);
            document.removeEventListener('keydown', onKeyDown, { capture: true });
            self.clearTimeout(geometryTimer);
        };
    }, [ eng, filterAll, pageSelectorFromURLHash, recomputeFilters ]);

    /**************************************************************************/

    const tabIdFromPageSelector = useCallback((): number => (
        eng.pageSelector !== '_'
            ? (parseInt(eng.pageSelector, 10) || 0)
            : eng.activeTabId
    ), [ eng ]);

    const actionsRef = useRef<LoggerActions | null>(null);
    if ( actionsRef.current === null ) {
        actionsRef.current = {
            selectPage(value: string) {
                self.location.replace('#' + value);
                pageSelectorFromURLHash();
                bump();
            },
            reloadTab(bypassCache: boolean) {
                const tabId = tabIdFromPageSelector();
                if ( tabId <= 0 ) { return; }
                void send('loggerUI', { what: 'reloadTab', tabId, bypassCache });
            },
            togglePause() {
                eng.paused = eng.paused === false;
                bump();
            },
            clean() {
                if ( eng.filtered.length === 0 ) { return; }
                let j = 0;
                let targetEntry = eng.filtered[0];
                for ( const entry of eng.entries ) {
                    if ( entry !== targetEntry ) { continue; }
                    if ( entry.voided ) { entry.dead = true; }
                    j += 1;
                    if ( j === eng.filtered.length ) { break; }
                    targetEntry = eng.filtered[j];
                }
                filterAll();
                bump();
            },
            clear() {
                if ( eng.filtered.length === 0 ) { return; }
                let clearUnrelated = true;
                if ( eng.selectedTabId !== 0 ) {
                    for ( const entry of eng.filtered ) {
                        if ( entry.tabId === eng.selectedTabId ) { clearUnrelated = false; break; }
                    }
                }
                let j = 0;
                let targetEntry = eng.filtered[0];
                for ( const entry of eng.entries ) {
                    if ( entry !== targetEntry ) { continue; }
                    if ( entry.tabId === eng.selectedTabId || clearUnrelated ) { entry.dead = true; }
                    j += 1;
                    if ( j === eng.filtered.length ) { break; }
                    targetEntry = eng.filtered[j];
                }
                filterAll();
                bump();
            },
            setFilterInput(value: string) {
                eng.filterInput = value;
                bump();
                self.clearTimeout(filterTimer.current);
                filterTimer.current = self.setTimeout(() => {
                    recomputeFilters();
                    filterAll();
                    bump();
                }, FILTER_DEBOUNCE);
            },
            toggleMasterFilter() {
                eng.masterFilter = eng.masterFilter === false;
                filterAll();
                bump();
            },
            toggleFiltex(filtex: string) {
                const on = new Set(eng.filtex.on);
                if ( on.has(filtex) ) { on.delete(filtex); } else { on.add(filtex); }
                eng.filtex = { on, not: eng.filtex.not };
                recomputeFilters();
                filterAll();
                bump();
            },
            toggleFiltexNot(groupId: string) {
                const not = new Set(eng.filtex.not);
                if ( not.has(groupId) ) { not.delete(groupId); } else { not.add(groupId); }
                eng.filtex = { on: eng.filtex.on, not };
                recomputeFilters();
                filterAll();
                bump();
            },
            resetFiltex() {
                eng.filtex = { on: new Set(), not: new Set() };
                recomputeFilters();
                filterAll();
                bump();
            },
            applySettings(next: LoggerSettings, persist: boolean) {
                eng.settings = next;
                if ( persist ) {
                    storage.set(LOGGER_SETTINGS_KEY, JSON.stringify(next));
                }
                bump();
            },
            toggleVExpanded() {
                eng.vExpanded = eng.vExpanded === false;
                bump();
            },
            toggleConsole() {
                eng.consoleOn = eng.consoleOn === false;
                bump();
            },
            toggleVerbose() {
                eng.verbose = eng.verbose === false;
                broadcastUBO({ what: 'loggerLevelChanged', level: eng.verbose ? 2 : 1 });
                bump();
            },
            clearConsole(ids: number[]) {
                if ( ids.length === 0 ) { return; }
                // Oldest (smallest id) first, matching the tail-first walk.
                const pending = ids.slice().sort((a, b) => b - a);
                let i = eng.entries.length;
                let id = pending.pop();
                while ( i-- ) {
                    if ( id === undefined ) { break; }
                    const entry = eng.entries[i];
                    if ( entry.id !== id ) { continue; }
                    eng.entries.splice(i, 1);
                    id = pending.pop();
                }
                filterAll();
                bump();
            },
            togglePopup() {
                if ( eng.popupTabId !== 0 ) {
                    eng.popupTabId = 0;
                } else {
                    const tabId = tabIdFromPageSelector();
                    if ( tabId === 0 ) { return; }
                    eng.popupTabId = tabId;
                }
                bump();
            },
            tabIdFromPageSelector,
        };
    }

    /**************************************************************************/

    const snapshot: LoggerSnapshot = {
        revision,
        rows: eng.filtered,
        entries: eng.entries,
        voidedCount: eng.voided,
        tabOptions: eng.tabOptions,
        activeTabId: eng.activeTabId,
        selectedTabId: eng.selectedTabId,
        pageSelector: eng.pageSelector,
        paused: eng.paused,
        masterFilter: eng.masterFilter,
        filterInput: eng.filterInput,
        filtex: eng.filtex,
        filterCount: eng.filters.length,
        cnameSeen: eng.cnameSeen,
        settings: eng.settings,
        tooltips: eng.tooltips,
        vExpanded: eng.vExpanded,
        consoleOn: eng.consoleOn,
        verbose: eng.verbose,
        popupTabId: eng.popupTabId,
    };
    return [ snapshot, actionsRef.current as LoggerActions ];
}

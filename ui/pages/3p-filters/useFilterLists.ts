import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onBroadcast } from '../../shared/broadcast';
import { send } from '../../shared/vapi';
import {
    buildTree, hashFromCurrent, hashFromDetails, haystack, hiddenListKeys,
    leavesOf, reValidExternalList, searchRegExp,
} from './model';
import type { BranchNode, LeafNode, TreeNode } from './model';
import type { AssetUpdatedMessage, CloudData, FilterListDiff, ListsetDetails } from './types';

// Globals the upstream dashboard shell and cloud widget expect on the pane.
declare global {
    interface Window {
        hasUnsavedData?: () => boolean;
        wikilink?: string;
        cloud?: {
            onPush: (() => unknown) | null;
            onPull: ((data: unknown, append: boolean) => void) | null;
        };
    }
}

export interface FilterListsState {
    details: ListsetDetails | null;
    tree: BranchNode[];
    leaves: LeafNode[];
    checked: ReadonlySet<string>;
    toRemove: ReadonlySet<string>;
    search: string;
    searchMatches: ReadonlySet<string> | null; // null = not searching
    importText: string;
    parseCosmeticFilters: boolean;
    ignoreGenericCosmeticFilters: boolean;
    autoUpdate: boolean;
    suspendUntilListsAreLoaded: boolean;
    updating: boolean;
    working: boolean;
    openDiffs: ReadonlySet<string>;
    dirty: boolean;
    hasObsolete: boolean;
    enabledCount: number;
    totalCount: number;
}

export interface FilterListsActions {
    toggleLeaf(key: string, on: boolean): void;
    toggleNode(node: BranchNode, on: boolean): void;
    toggleRemove(key: string): void;
    purge(node: TreeNode, preferOrigin: boolean): void;
    apply(): Promise<void>;
    update(): Promise<void>;
    setSearch(value: string): void;
    setImportText(value: string): void;
    setParseCosmeticFilters(value: boolean): void;
    setIgnoreGenericCosmeticFilters(value: boolean): void;
    setAutoUpdate(value: boolean): void;
    setSuspendUntilListsAreLoaded(value: boolean): void;
    toggleDiff(key: string): void;
}

const toggleIn = (set: ReadonlySet<string>, key: string, on: boolean): Set<string> => {
    const next = new Set(set);
    if ( on ) { next.add(key); } else { next.delete(key); }
    return next;
};

export function useFilterLists(): [ FilterListsState, FilterListsActions ] {
    const [ details, setDetails ] = useState<ListsetDetails | null>(null);
    const [ checked, setChecked ] = useState<ReadonlySet<string>>(new Set());
    const [ toRemove, setToRemove ] = useState<ReadonlySet<string>>(new Set());
    const [ search, setSearch ] = useState('');
    const [ importText, setImportText ] = useState('');
    const [ parseCosmeticFilters, setParseCosmeticFilters ] = useState(false);
    const [ ignoreGenericCosmeticFilters, setIgnoreGenericCosmeticFilters ] = useState(false);
    const [ autoUpdate, setAutoUpdateState ] = useState(false);
    const [ suspendUntilListsAreLoaded, setSuspendState ] = useState(false);
    const [ updating, setUpdating ] = useState(false);
    const [ working, setWorking ] = useState(false);
    const [ openDiffs, setOpenDiffs ] = useState<ReadonlySet<string>>(new Set());
    const [ baseline, setBaseline ] = useState('');

    // Latest values for callbacks that must not go stale (cloud, apply).
    const latest = useRef({ details, checked, toRemove, importText, parseCosmeticFilters, ignoreGenericCosmeticFilters, search });
    latest.current = { details, checked, toRemove, importText, parseCosmeticFilters, ignoreGenericCosmeticFilters, search };

    const tree = useMemo(() => (details === null ? [] : buildTree(details)), [ details ]);
    const leaves = useMemo(() => {
        const out: LeafNode[] = [];
        for ( const group of tree ) { out.push(...leavesOf(group)); }
        return out;
    }, [ tree ]);
    const leafKeys = useMemo(() => leaves.map(l => l.key), [ leaves ]);
    const leafKeysRef = useRef(leafKeys);
    leafKeysRef.current = leafKeys;

    // Load (and reload on staticFilteringDataChanged). Entries already on the
    // page keep their checked/remove state, new ones take the stored flag.
    const load = useCallback(async () => {
        const response = await send<ListsetDetails>('dashboard', { what: 'getLists' });
        const known = new Set(Object.keys(latest.current.details?.available ?? {}));
        const prevChecked = latest.current.checked;
        const nextChecked = new Set<string>();
        for ( const [ key, d ] of Object.entries(response.available) ) {
            const on = known.has(key) ? prevChecked.has(key) : d.off !== true;
            if ( on ) { nextChecked.add(key); }
        }
        setDetails(response);
        setChecked(nextChecked);
        setToRemove(prev => new Set(Array.from(prev).filter(k => Object.hasOwn(response.available, k))));
        setBaseline(hashFromDetails(response));
        setParseCosmeticFilters(response.parseCosmeticFilters === true);
        setIgnoreGenericCosmeticFilters(response.ignoreGenericCosmeticFilters === true);
        setAutoUpdateState(response.autoUpdate === true);
        setSuspendState(response.suspendUntilListsAreLoaded === true);
        setUpdating(response.isUpdating === true);
        return response;
    }, []);

    // Upstream: after the first load, auto-update when allowed and needed.
    const [ autoUpdatePending, setAutoUpdatePending ] = useState(false);
    useEffect(() => {
        load().then(response => {
            if ( response.isUpdating || response.autoUpdate !== true ) { return; }
            const obsolete = Object.entries(response.available).some(([ key, d ]) =>
                d.off !== true && response.cache[key]?.obsolete === true
            );
            if ( obsolete ) { setAutoUpdatePending(true); }
        });
    }, [ load ]);

    useEffect(() => onBroadcast(msg => {
        switch ( msg.what ) {
        case 'assetUpdated': {
            const m = msg as unknown as AssetUpdatedMessage;
            setDetails(prev => {
                if ( prev === null || Object.hasOwn(prev.available, m.key) === false ) { return prev; }
                const asset = { ...(prev.cache[m.key] || {}) };
                asset.error = m.failed ? true : undefined;
                asset.obsolete = !m.cached;
                asset.cached = !!m.cached;
                if ( m.cached ) { asset.writeTime = Date.now(); }
                return { ...prev, cache: { ...prev.cache, [m.key]: asset } };
            });
            break;
        }
        case 'assetsUpdated':
            setUpdating(false);
            break;
        case 'staticFilteringDataChanged':
            load();
            break;
        case 'filterListDiffUpdated':
            setDetails(prev => {
                if ( prev === null ) { return prev; }
                const diffs = { ...(prev.filterListDiffs || {}) };
                const key = msg.key as string;
                if ( msg.diff === undefined ) { delete diffs[key]; } else { diffs[key] = msg.diff as FilterListDiff; }
                return { ...prev, filterListDiffs: diffs };
            });
            break;
        default:
            break;
        }
    }), [ load ]);

    const searchMatches = useMemo(() => {
        const re = searchRegExp(search);
        if ( re === null ) { return null; }
        const out = new Set<string>();
        for ( const leaf of leaves ) {
            if ( re.test(haystack(leaf)) ) { out.add(leaf.key); }
        }
        return out;
    }, [ search, leaves ]);

    const dirty = details !== null && hashFromCurrent(details, leafKeys, { checked, toRemove }, {
        parseCosmeticFilters, ignoreGenericCosmeticFilters, importText,
    }) !== baseline;

    const hasObsolete = details !== null && leafKeys.some(key =>
        checked.has(key) && toRemove.has(key) === false && details.cache[key]?.obsolete === true
    );
    const enabledCount = leafKeys.filter(key => checked.has(key) && toRemove.has(key) === false).length;

    // Dashboard shell contract.
    useEffect(() => {
        self.hasUnsavedData = () => dirty;
        self.wikilink = 'https://github.com/gorhill/uBlock/wiki/Dashboard:-Filter-lists';
    }, [ dirty ]);

    const toggleLeaf = useCallback((key: string, on: boolean) => {
        setChecked(prev => toggleIn(prev, key, on));
    }, []);

    const toggleNode = useCallback((node: BranchNode, on: boolean) => {
        const matches = latest.current.search !== '' ? searchMatches : null;
        setChecked(prev => {
            const next = new Set(prev);
            for ( const leaf of leavesOf(node) ) {
                if ( matches !== null && matches.has(leaf.key) === false ) { continue; }
                if ( on ) { next.add(leaf.key); } else { next.delete(leaf.key); }
            }
            return next;
        });
    }, [ searchMatches ]);

    const toggleRemove = useCallback((key: string) => {
        setToRemove(prev => toggleIn(prev, key, prev.has(key) === false));
    }, []);

    const purge = useCallback((node: TreeNode, preferOrigin: boolean) => {
        const keys = leavesOf(node).map(l => l.key);
        const assetKeys = node.kind === 'leaf' ? keys : [ node.key, ...keys ];
        setDetails(prev => {
            if ( prev === null ) { return prev; }
            const cache = { ...prev.cache };
            for ( const key of keys ) {
                cache[key] = { ...(cache[key] || {}), obsolete: true, cached: false };
            }
            return { ...prev, cache };
        });
        send('dashboard', { what: 'listsUpdateNow', assetKeys, preferOrigin });
        setUpdating(true);
    }, []);

    // Upstream selectFilterLists(): resolve imports that match stock lists,
    // push the two cosmetic settings, then apply the selection.
    const selectFilterLists = useCallback(async () => {
        const cur = latest.current;
        const leafKeys = leafKeysRef.current;
        // An empty toSelect would deselect every list in storage: never send it
        // before the catalog is on screen.
        if ( cur.details === null || leafKeys.length === 0 ) { return; }
        const d: ListsetDetails = { ...cur.details, available: { ...cur.details.available } };
        const nextChecked = new Set(cur.checked);
        const after: string[] = [];
        for ( const line of cur.importText.split(/\s+/) ) {
            after.push(line);
            if ( /^https?:\/\//.test(line) === false ) { continue; }
            for ( const [ key, list ] of Object.entries(d.available) ) {
                if ( list.content !== 'filters' ) { continue; }
                if ( list.contentURL === undefined ) { continue; }
                if ( list.contentURL.includes(line) === false ) { continue; }
                nextChecked.add(key);
                after.pop();
                break;
            }
        }
        const toImport = after.join('\n');
        setImportText('');

        send('dashboard', { what: 'userSettings', name: 'parseAllABPHideFilters', value: cur.parseCosmeticFilters });
        d.parseCosmeticFilters = cur.parseCosmeticFilters;
        send('dashboard', { what: 'userSettings', name: 'ignoreGenericCosmeticFilters', value: cur.ignoreGenericCosmeticFilters });
        d.ignoreGenericCosmeticFilters = cur.ignoreGenericCosmeticFilters;

        const toSelect: string[] = [];
        const toRemoveKeys: string[] = [];
        for ( const key of leafKeys ) {
            if ( Object.hasOwn(d.available, key) === false ) { continue; }
            const list = { ...d.available[key] };
            if ( cur.toRemove.has(key) ) {
                toRemoveKeys.push(key);
                list.off = true;
            } else if ( nextChecked.has(key) ) {
                toSelect.push(key);
                list.off = false;
            } else {
                list.off = true;
            }
            d.available[key] = list;
        }
        for ( const key of hiddenListKeys(d) ) {
            if ( d.available[key].off === true ) { continue; }
            toSelect.push(key);
        }
        setDetails(d);
        setChecked(nextChecked);
        setToRemove(new Set());
        setBaseline(hashFromDetails(d));
        await send('dashboard', { what: 'applyFilterListSelection', toSelect, toImport, toRemove: toRemoveKeys });
    }, []);

    const apply = useCallback(async () => {
        await selectFilterLists();
        setWorking(true);
        await send('dashboard', { what: 'reloadAllFilters' });
        setWorking(false);
    }, [ selectFilterLists ]);

    const update = useCallback(async () => {
        await selectFilterLists();
        setUpdating(true);
        send('dashboard', { what: 'updateNow' });
    }, [ selectFilterLists ]);

    useEffect(() => {
        if ( autoUpdatePending === false || leafKeys.length === 0 ) { return; }
        setAutoUpdatePending(false);
        update();
    }, [ autoUpdatePending, leafKeys, update ]);

    const setAutoUpdate = useCallback((value: boolean) => {
        setAutoUpdateState(value);
        send('dashboard', { what: 'userSettings', name: 'autoUpdate', value });
    }, []);
    const setSuspendUntilListsAreLoaded = useCallback((value: boolean) => {
        setSuspendState(value);
        send('dashboard', { what: 'userSettings', name: 'suspendUntilListsAreLoaded', value });
    }, []);

    const toggleDiff = useCallback((key: string) => {
        setOpenDiffs(prev => toggleIn(prev, key, prev.has(key) === false));
    }, []);

    // Cloud storage bridge hooks.
    useEffect(() => {
        const cloud = self.cloud;
        if ( cloud === undefined ) { return; }
        cloud.onPush = () => {
            const cur = latest.current;
            const selectedLists = leafKeysRef.current.filter(key => cur.checked.has(key));
            if ( cur.details !== null ) {
                for ( const key of hiddenListKeys(cur.details) ) {
                    if ( cur.details.available[key].off !== true ) { selectedLists.push(key); }
                }
            }
            return {
                parseCosmeticFilters: cur.parseCosmeticFilters,
                ignoreGenericCosmeticFilters: cur.ignoreGenericCosmeticFilters,
                selectedLists,
            } satisfies CloudData;
        };
        cloud.onPull = (raw, append) => {
            if ( typeof raw !== 'object' || raw === null ) { return; }
            const data = raw as CloudData;
            const cur = latest.current;
            setParseCosmeticFilters(data.parseCosmeticFilters === true || (append && cur.parseCosmeticFilters));
            setIgnoreGenericCosmeticFilters(data.ignoreGenericCosmeticFilters === true || (append && cur.ignoreGenericCosmeticFilters));
            const selected = new Set(data.selectedLists || []);
            setChecked(prev => {
                const next = new Set(prev);
                for ( const key of leafKeysRef.current ) {
                    const mustEnable = selected.has(key);
                    selected.delete(key);
                    if ( mustEnable === false && append ) { continue; }
                    if ( mustEnable ) { next.add(key); } else { next.delete(key); }
                }
                return next;
            });
            if ( cur.details !== null ) {
                const d: ListsetDetails = { ...cur.details, available: { ...cur.details.available } };
                for ( const key of hiddenListKeys(d) ) {
                    const mustEnable = selected.has(key);
                    selected.delete(key);
                    if ( mustEnable === false && append ) { continue; }
                    d.available[key] = { ...d.available[key], off: mustEnable === false };
                }
                setDetails(d);
            }
            for ( const key of Array.from(selected) ) {
                if ( reValidExternalList.test(key) === false ) { selected.delete(key); }
            }
            if ( selected.size !== 0 ) {
                const lines = append ? cur.importText.split(/[\n\r]+/) : [];
                lines.push(...selected);
                if ( lines.length !== 0 ) { lines.push(''); }
                setImportText(lines.join('\n'));
            }
        };
        return () => { cloud.onPush = null; cloud.onPull = null; };
    }, []);

    const state: FilterListsState = {
        details, tree, leaves, checked, toRemove, search, searchMatches, importText,
        parseCosmeticFilters, ignoreGenericCosmeticFilters, autoUpdate, suspendUntilListsAreLoaded,
        updating, working, openDiffs, dirty, hasObsolete, enabledCount, totalCount: leafKeys.length,
    };
    const actions: FilterListsActions = {
        toggleLeaf, toggleNode, toggleRemove, purge, apply, update, setSearch, setImportText,
        setParseCosmeticFilters, setIgnoreGenericCosmeticFilters, setAutoUpdate, setSuspendUntilListsAreLoaded,
        toggleDiff,
    };
    return [ state, actions ];
}

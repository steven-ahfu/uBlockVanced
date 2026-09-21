import { useCallback, useEffect, useRef, useState } from 'react';
import { onBroadcast } from '../../shared/broadcast';
import { t } from '../../shared/i18n';
import { send, storage } from '../../shared/vapi';
import { normalizeFilterImportText, parseFilterExportText } from '../../../src/js/filter-export.js';
import { normalizeHostname } from '../../../src/js/user-filters.js';
import type { EditorHandle } from './useEditor';

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

interface UserFiltersResponse {
    content: string;
    enabled: boolean;
    trusted: boolean;
    disabledSites?: string[];
    error?: unknown;
}

interface FilterState { enabled: boolean; trusted: boolean; filters: string }

export interface UserFiltersState {
    ready: boolean;
    enabled: boolean;
    trusted: boolean;
    changed: boolean;
    hasContent: boolean;
    sites: string[];
    siteStatus: string;
    siteBusy: boolean;
    importNotice: string;
    domainStatus: string;
    checkingDomains: boolean;
}

export interface UserFiltersActions {
    setEnabled(value: boolean): void;
    setTrusted(value: boolean): void;
    apply(): Promise<void>;
    revert(): void;
    importFile(file: File): void;
    exportText(): void;
    exportJSON(): void;
    checkDeadDomains(): Promise<void>;
    addSite(hostname: string): Promise<boolean>;
    removeSite(hostname: string): Promise<void>;
    /** Recompute the unsaved state after an editor change. */
    sync(): void;
}

// Upstream three-way merge: background changes to user filters are folded
// into an editor that has unsaved edits (no deletions assumed).
function threeWayMerge(original: string, newContent: string, editorText: string): string {
    const prvContent = original.trim().split(/\n/);
    const differ = new diff_match_patch();
    const newChanges = differ.diff(prvContent, newContent.trim().split(/\n/));
    const usrChanges = differ.diff(prvContent, editorText.trim().split(/\n/));
    const out: string[] = [];
    let i = 0, j = 0, k = 0;
    while ( i < prvContent.length ) {
        for ( ; j < newChanges.length; j++ ) {
            const change = newChanges[j];
            if ( change[0] !== 1 ) { break; }
            out.push(change[1]);
        }
        for ( ; k < usrChanges.length; k++ ) {
            const change = usrChanges[k];
            if ( change[0] !== 1 ) { break; }
            out.push(change[1]);
        }
        if ( k === usrChanges.length || usrChanges[k][0] !== -1 ) {
            out.push(prvContent[i]);
        }
        i += 1; j += 1; k += 1;
    }
    for ( ; j < newChanges.length; j++ ) {
        if ( newChanges[j][0] === 1 ) { out.push(newChanges[j][1]); }
    }
    for ( ; k < usrChanges.length; k++ ) {
        if ( usrChanges[k][0] === 1 ) { out.push(usrChanges[k][1]); }
    }
    return out.join('\n');
}

export function useUserFilters(editor: EditorHandle | null): [ UserFiltersState, UserFiltersActions ] {
    const [ ready, setReady ] = useState(false);
    const [ enabled, setEnabledState ] = useState(true);
    const [ trusted, setTrustedState ] = useState(false);
    const [ changed, setChanged ] = useState(false);
    const [ hasContent, setHasContent ] = useState(false);
    const [ sites, setSites ] = useState<string[]>([]);
    const [ siteStatus, setSiteStatus ] = useState('');
    const [ siteBusy, setSiteBusy ] = useState(false);
    const [ importNotice, setImportNotice ] = useState('');
    const [ domainStatus, setDomainStatus ] = useState('');
    const [ checkingDomains, setCheckingDomains ] = useState(false);
    const original = useRef<FilterState>({ enabled: true, trusted: false, filters: '' });
    const latest = useRef({ enabled, trusted });
    latest.current = { enabled, trusted };
    const editorRef = useRef(editor);
    editorRef.current = editor;

    const currentState = useCallback((): FilterState => ({
        enabled: latest.current.enabled,
        trusted: latest.current.trusted,
        filters: editorRef.current?.getText() ?? '',
    }), []);

    const isChanged = useCallback((): boolean =>
        JSON.stringify(currentState()) !== JSON.stringify(original.current), [ currentState ]);

    // Re-tokenise the editor when trust changes, as upstream userFiltersChanged().
    const sync = useCallback((forced?: boolean) => {
        const ed = editorRef.current;
        const nowChanged = typeof forced === 'boolean' ? forced : isChanged();
        setChanged(nowChanged);
        setHasContent((ed?.getText() ?? '').trim() !== '');
        if ( ed === null ) { return; }
        const { cm } = ed;
        const trustedBefore = cm.getOption('trustedSource');
        const trustedAfter = latest.current.enabled && latest.current.trusted;
        if ( trustedAfter === trustedBefore ) { return; }
        cm.startOperation();
        cm.setOption('trustedSource', trustedAfter);
        const doc = cm.getDoc();
        const history = doc.getHistory();
        const selections = doc.listSelections();
        doc.replaceRange(doc.getValue(), { line: 0, ch: 0 }, { line: doc.lineCount(), ch: 0 });
        doc.setSelections(selections);
        doc.setHistory(history);
        cm.endOperation();
        cm.focus();
    }, [ isChanged ]);
    const syncRef = useRef(sync);
    syncRef.current = sync;

    const load = useCallback(async (): Promise<UserFiltersResponse | null> => {
        const ed = editorRef.current;
        if ( ed === null ) { return null; }
        const details = await send<UserFiltersResponse>('dashboard', { what: 'readUserFilters' });
        if ( details instanceof Object === false || details.error ) { return null; }
        ed.cm.setOption('trustedSource', details.trusted);
        latest.current = { enabled: details.enabled, trusted: details.trusted };
        setEnabledState(details.enabled);
        setTrustedState(details.trusted);
        setSites(Array.isArray(details.disabledSites) ? details.disabledSites : []);
        ed.setText(details.content.trim());
        original.current = { enabled: details.enabled, trusted: details.trusted, filters: ed.getText() };
        syncRef.current(false);
        return details;
    }, []);

    // First load: content, cursor restore, then background merge listener.
    useEffect(() => {
        if ( editor === null ) { return; }
        let disposed = false;
        let dispose = () => {};
        (async () => {
            await load();
            if ( disposed ) { return; }
            editor.cm.clearHistory();
            const line = await storage.get<number>('myFiltersCursorPosition');
            if ( disposed ) { return; }
            if ( typeof line === 'number' ) { editor.cm.setCursor(line, 0); }
            editor.cm.focus();
            setReady(true);
            dispose = onBroadcast(msg => {
                switch ( msg.what ) {
                case 'userFiltersUpdated': {
                    const { cm } = editor;
                    cm.startOperation();
                    const scroll = cm.getScrollInfo();
                    const selections = cm.listSelections();
                    const shouldMerge = isChanged();
                    const beforeContent = editor.getText();
                    const beforeOriginal = original.current.filters;
                    load().then(() => {
                        if ( shouldMerge ) {
                            editor.setText(threeWayMerge(beforeOriginal, editor.getText(), beforeContent));
                            syncRef.current(true);
                        }
                        cm.clearHistory();
                        cm.setSelection(selections[0].anchor, selections[0].head);
                        cm.scrollTo(scroll.left, scroll.top);
                        cm.endOperation();
                    });
                    break;
                }
                case 'userFiltersSitesUpdated':
                    setSites(Array.isArray(msg.sites) ? msg.sites as string[] : []);
                    break;
                default:
                    break;
                }
            });
        })();
        return () => { disposed = true; dispose(); };
    }, [ editor, load, isChanged ]);

    // Dashboard shell + cloud widget contracts.
    useEffect(() => {
        self.hasUnsavedData = () => isChanged();
        self.wikilink = 'https://github.com/gorhill/uBlock/wiki/Dashboard:-My-filters';
        const cloud = self.cloud;
        if ( cloud === undefined ) { return; }
        cloud.onPush = () => editorRef.current?.getText() ?? '';
        cloud.onPull = (data, append) => {
            const ed = editorRef.current;
            if ( ed === null || typeof data !== 'string' ) { return; }
            ed.cm.setValue(append ? uBlockDashboard.mergeNewLines(ed.getText(), data) : data);
            syncRef.current();
        };
        return () => { cloud.onPush = null; cloud.onPull = null; };
    }, [ isChanged ]);

    const setEnabled = useCallback((value: boolean) => {
        latest.current = { ...latest.current, enabled: value };
        setEnabledState(value);
        syncRef.current();
    }, []);
    const setTrusted = useCallback((value: boolean) => {
        latest.current = { ...latest.current, trusted: value };
        setTrustedState(value);
        syncRef.current();
    }, []);

    const apply = useCallback(async () => {
        const state = currentState();
        const details = await send<{ error?: unknown } | null>('dashboard', {
            what: 'writeUserFilters',
            content: state.filters,
            enabled: state.enabled,
            trusted: state.trusted,
        });
        if ( details instanceof Object === false || details.error ) { return; }
        original.current = state;
        syncRef.current(false);
        send('dashboard', { what: 'reloadAllFilters' });
    }, [ currentState ]);

    const revert = useCallback(() => {
        const ed = editorRef.current;
        if ( ed === null ) { return; }
        latest.current = { enabled: original.current.enabled, trusted: original.current.trusted };
        setEnabledState(original.current.enabled);
        setTrustedState(original.current.trusted);
        ed.setText(original.current.filters);
        syncRef.current();
    }, []);

    const importFile = useCallback((file: File) => {
        const ed = editorRef.current;
        if ( ed === null || file.name === '' || file.type.indexOf('text') !== 0 ) { return; }
        const fr = new FileReader();
        fr.onload = () => {
            if ( typeof fr.result !== 'string' ) { return; }
            const imported = normalizeFilterImportText(fr.result);
            const content = uBlockDashboard.mergeNewLines(ed.getText(), imported.text);
            ed.cm.operation(() => {
                const pos = ed.cm.getCursor();
                ed.setText(content);
                ed.cm.setCursor(pos);
                ed.cm.focus();
            });
            if ( imported.notes.length !== 0 ) { setImportNotice(t('1pImportCompatibilityNotice')); }
        };
        fr.readAsText(file);
    }, []);

    const exportText = useCallback(() => {
        const val = editorRef.current?.getText() ?? '';
        if ( val === '' ) { return; }
        const filename = t('1pExportFilename')
            .replace('{{datetime}}', uBlockDashboard.dateNowToSensibleString())
            .replace(/ +/g, '_');
        vAPI.download({ url: `data:text/plain;charset=utf-8,${encodeURIComponent(val)}`, filename });
    }, []);

    const exportJSON = useCallback(() => {
        const val = editorRef.current?.getText() ?? '';
        if ( val === '' ) { return; }
        const { rules, unassignedNotes } = parseFilterExportText(val);
        const data: Record<string, unknown> = {
            format: 'uBlockVanced-filters',
            version: '1.0',
            exportedAt: new Date().toISOString(),
            filterCount: rules.length,
            rules,
        };
        if ( unassignedNotes.length !== 0 ) { data.unassignedNotes = unassignedNotes; }
        const json = JSON.stringify(data, null, 2);
        const filename = 'uBlockVanced-filters_' + uBlockDashboard.dateNowToSensibleString().replace(/ +/g, '_') + '.json';
        vAPI.download({ url: `data:application/json;charset=utf-8,${encodeURIComponent(json)}`, filename });
    }, []);

    const deadDomainAbort = useRef<AbortController | null>(null);
    const checkDeadDomains = useCallback(async () => {
        const ed = editorRef.current;
        if ( ed === null ) { return; }
        if ( deadDomainAbort.current ) { deadDomainAbort.current.abort(); }
        setCheckingDomains(true);
        const lines = ed.getText().split('\n');
        const domainRe = /^([a-zA-Z0-9][\w.-]+\.\w{2,})(##|#@#|\$|,|\^)/;
        const domains = new Set<string>();
        for ( const line of lines ) {
            if ( line.startsWith('!') || line.startsWith('[') || line.trim() === '' ) { continue; }
            const m = line.match(domainRe);
            if ( m && m[1] !== '*' ) { domains.add(m[1]); }
        }
        const MAX_DOMAINS = 100;
        if ( domains.size === 0 ) {
            setDomainStatus('No domains found in filters');
            setCheckingDomains(false);
            return;
        }
        if ( domains.size > MAX_DOMAINS ) {
            setDomainStatus(`Too many domains (${domains.size}). Max ${MAX_DOMAINS}.`);
            setCheckingDomains(false);
            return;
        }
        const controller = new AbortController();
        deadDomainAbort.current = controller;
        const { signal } = controller;
        const dead: string[] = [];
        let checked = 0;
        const probe = (url: string) => fetch(url, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: AbortSignal.any([ signal, AbortSignal.timeout(4000) ]),
        });
        for ( const domain of domains ) {
            if ( signal.aborted ) { break; }
            checked += 1;
            setDomainStatus(`Checking ${checked}/${domains.size}...`);
            try {
                await probe(`https://${domain}/`);
            } catch {
                if ( signal.aborted ) { break; }
                try {
                    await probe(`http://${domain}/`);
                } catch {
                    if ( signal.aborted === false ) { dead.push(domain); }
                }
            }
        }
        deadDomainAbort.current = null;
        setDomainStatus(dead.length > 0
            ? `${dead.length} dead domain(s): ${dead.join(', ')}`
            : `All ${domains.size} domains are reachable`);
        if ( dead.length > 0 ) {
            const { cm } = ed;
            for ( let i = 0; i < cm.lineCount(); i++ ) {
                const lineText = cm.getLine(i);
                for ( const d of dead ) {
                    if ( lineText.startsWith(d + '##') || lineText.startsWith(d + '#@#') ||
                        lineText.startsWith(d + '$') || lineText.startsWith(d + '^') ) {
                        cm.addLineClass(i, 'background', 'dead-domain-line');
                    }
                }
            }
        }
        setCheckingDomains(false);
    }, []);

    const addSite = useCallback(async (value: string): Promise<boolean> => {
        const hostname = normalizeHostname(value);
        if ( hostname === undefined ) {
            setSiteStatus(t('1pUserFiltersPerSiteInvalid'));
            return false;
        }
        setSiteBusy(true);
        const result = await send<{ sites?: string[]; error?: unknown } | null>('dashboard', {
            what: 'setUserFilterSite', hostname, disabled: true,
        });
        setSiteBusy(false);
        if ( result instanceof Object && result.error === undefined ) {
            setSites(result.sites ?? []);
            setSiteStatus(t('1pUserFiltersPerSiteSaved'));
            return true;
        }
        setSiteStatus(t('1pUserFiltersPerSiteError'));
        return false;
    }, []);

    const removeSite = useCallback(async (hostname: string) => {
        const result = await send<{ sites?: string[]; error?: unknown } | null>('dashboard', {
            what: 'setUserFilterSite', hostname, disabled: false,
        });
        if ( result instanceof Object && result.error === undefined ) {
            setSites(result.sites ?? []);
            setSiteStatus(t('1pUserFiltersPerSiteSaved'));
        } else {
            setSiteStatus(t('1pUserFiltersPerSiteError'));
        }
    }, []);

    const state: UserFiltersState = {
        ready, enabled, trusted, changed, hasContent, sites, siteStatus, siteBusy,
        importNotice, domainStatus, checkingDomains,
    };
    const actions: UserFiltersActions = {
        setEnabled, setTrusted, apply, revert, importFile, exportText, exportJSON,
        checkDeadDomains, addSite, removeSite,
        sync: () => { syncRef.current(); },
    };
    return [ state, actions ];
}

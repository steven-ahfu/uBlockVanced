import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../shared/i18n';
import { send, storage } from '../../shared/vapi';
import { hostnameFromURI } from '../../../src/js/uri-utils.js';
import publicSuffixList from '../../../src/lib/publicsuffixlist/publicsuffixlist.js';
import type { MergeHandle } from './useMergeView';

// Port of upstream src/js/dyna-rules.js on top of the MergeView handle.
// CodeMirror is driven imperatively through refs; React state only carries
// what the toolbar renders.

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

interface RulesResponse {
    permanentRules: string[];
    sessionRules: string[];
    pslSelfie?: unknown;
}

interface Pane { doc: CMPane; original: string[]; modified: string[] }

export interface PresentationState { sortType: number; isCollapsed: boolean; filter: string }

export interface DynaRulesState {
    loaded: boolean;
    isClean: boolean;
    isDirty: boolean;
    sortType: number;
    isCollapsed: boolean;
    filter: string;
}

export interface DynaRulesActions {
    setFilter(value: string): void;
    setSortType(value: number): void;
    toggleCollapsed(): void;
    importFile(file: File): void;
    exportFile(): void;
    revertAll(): void;
    commitAll(): void;
    editSave(): void;
}

const reSwRule = /^([^/]+): ([^/ ]+) ([^ ]+)/;
const reRule = /^([^ ]+) ([^/ ]+) ([^ ]+ [^ ]+)/;
const reUrlRule = /^([^ ]+) ([^ ]+) ([^ ]+ [^ ]+)/;

export function useDynaRules(merge: MergeHandle | null): [ DynaRulesState, DynaRulesActions ] {
    const [ loaded, setLoaded ] = useState(false);
    const [ isClean, setIsClean ] = useState(true);
    const [ isDirty, setIsDirty ] = useState(false);
    const [ presentation, setPresentation ] = useState<PresentationState>({ sortType: 0, isCollapsed: false, filter: '' });

    const panes = useRef<{ orig: Pane; edit: Pane } | null>(null);
    const pres = useRef<PresentationState>(presentation);
    const cleanEditToken = useRef(0);
    const cleanEditText = useRef('');
    const differ = useRef<InstanceType<typeof diff_match_patch> | null>(null);
    const hostnameToDomainMap = useRef(new Map<string, string>());
    const overlay = useRef<unknown>(null);
    const textTimer = useRef<number | undefined>(undefined);
    const filterTimer = useRef<number | undefined>(undefined);

    const getDiffer = () => {
        if ( differ.current === null ) { differ.current = new diff_match_patch(); }
        return differ.current as unknown as { diff_main(a: string, b: string): Array<[ number, string ]> };
    };

    const savePresentation = (next: PresentationState) => {
        pres.current = next;
        setPresentation(next);
        storage.set('dynaRulesPresentationState', next);
    };

    // Search overlay, borrowed by upstream from the CodeMirror search addon.
    const makeOverlay = () => {
        const f = pres.current.filter;
        const reFilter = f !== '' ? new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : undefined;
        return {
            token(stream: CMStream) {
                if ( reFilter !== undefined ) {
                    reFilter.lastIndex = stream.pos;
                    const match = reFilter.exec(stream.string);
                    if ( match !== null ) {
                        if ( match.index === stream.pos ) {
                            stream.pos += match[0].length || 1;
                            return 'searching';
                        }
                        stream.pos = match.index;
                        return;
                    }
                }
                stream.skipToEnd();
            },
        };
    };

    const filterRules = (pane: Pane): string[] => {
        const filter = pres.current.filter;
        if ( filter === '' ) { return pane.modified; }
        return pane.modified.filter(rule => rule.indexOf(filter) !== -1);
    };

    // Upstream onTextChanged(): derive clean/dirty from the editor generation.
    const onTextChanged = useCallback((now?: boolean) => {
        if ( merge === null ) { return; }
        const process = (details?: unknown) => {
            textTimer.current = undefined;
            const edit = merge.edit;
            let clean = edit.isClean(cleanEditToken.current);
            if ( details === undefined && clean === false && edit.getValue().trim() === cleanEditText.current ) {
                cleanEditToken.current = edit.changeGeneration();
                clean = true;
            }
            const dirty = merge.mv.leftChunks().length !== 0;
            setIsClean(clean);
            setIsDirty(dirty);
            document.body.classList.toggle('editing', clean === false);
        };
        if ( textTimer.current !== undefined ) { self.cancelIdleCallback(textTimer.current); }
        if ( now ) { process(); textTimer.current = undefined; return; }
        textTimer.current = self.requestIdleCallback(() => process(), { timeout: 57 });
    }, [ merge ]);

    // Upstream rulesToDoc(): incremental text update, preserving scroll.
    const rulesToDoc = useCallback((clearHistory: boolean) => {
        if ( merge === null || panes.current === null ) { return; }
        const { orig, edit } = panes.current;
        orig.doc.startOperation();
        edit.doc.startOperation();
        for ( const pane of [ orig, edit ] ) {
            const doc = pane.doc;
            const rules = filterRules(pane);
            if ( clearHistory || (doc.lineCount() === 1 && doc.getValue() === '') || rules.length === 0 ) {
                doc.setValue(rules.length !== 0 ? rules.join('\n') + '\n' : '');
                continue;
            }
            const beforeText = doc.getValue();
            let afterText = rules.join('\n').trim();
            if ( afterText !== '' ) { afterText += '\n'; }
            const diffs = getDiffer().diff_main(beforeText, afterText);
            let i = diffs.length;
            let iedit = beforeText.length;
            while ( i-- ) {
                const diff = diffs[i];
                if ( diff[0] === 0 ) { iedit -= diff[1].length; continue; }
                const end = doc.posFromIndex(iedit);
                if ( diff[0] === 1 ) { doc.replaceRange(diff[1], end, end); continue; }
                iedit -= diff[1].length;
                const beg = doc.posFromIndex(iedit);
                doc.replaceRange('', beg, end);
            }
        }
        for ( const mark of edit.doc.getAllMarks() ) {
            if ( mark.uboEllipsis === true ) { mark.clear(); }
        }
        if ( pres.current.isCollapsed ) {
            for ( let iline = 0, n = edit.doc.lineCount(); iline < n; iline++ ) {
                if ( edit.doc.getLine(iline) !== '...' ) { continue; }
                const mark = edit.doc.markText({ line: iline, ch: 0 }, { line: iline + 1, ch: 0 }, { atomic: true, readOnly: true });
                mark.uboEllipsis = true;
            }
        }
        orig.doc.endOperation();
        edit.doc.endOperation();
        cleanEditText.current = merge.edit.getValue().trim();
        cleanEditToken.current = merge.edit.changeGeneration();
        if ( clearHistory !== true ) { return; }
        merge.edit.clearHistory();
        const chunks = merge.mv.leftChunks();
        if ( chunks.length === 0 ) { return; }
        const ldoc = orig.doc;
        const { clientHeight } = ldoc.getScrollInfo();
        const line = Math.min(chunks[0].editFrom, chunks[0].origFrom);
        ldoc.setCursor(line, 0);
        ldoc.scrollIntoView({ line, ch: 0 }, (clientHeight - ldoc.defaultTextHeight()) / 2);
    }, [ merge ]);

    // Upstream onPresentationChanged(): sort, collapse, then render.
    const onPresentationChanged = useCallback((clearHistory: boolean) => {
        if ( merge === null || panes.current === null ) { return; }
        const sortNormalizeHn = (hn: string): string => {
            let domain = hostnameToDomainMap.current.get(hn);
            if ( domain === undefined ) {
                domain = /(\d|\])$/.test(hn) ? hn : publicSuffixList.getDomain(hn);
                hostnameToDomainMap.current.set(hn, domain);
            }
            let normalized = domain || hn;
            if ( hn.length !== domain.length ) {
                const subdomains = hn.slice(0, hn.length - domain.length - 1);
                normalized += '.' + (subdomains.includes('.') ? subdomains.split('.').reverse().join('.') : subdomains);
            }
            return normalized;
        };
        const slotFromRule = (rule: string) => {
            let type = '', srcHn = '', desHn = '', extra = '';
            let match = reSwRule.exec(rule);
            if ( match !== null ) {
                type = ' ' + match[1];
                srcHn = sortNormalizeHn(match[2]);
                desHn = srcHn;
                extra = match[3];
            } else if ( (match = reRule.exec(rule)) !== null ) {
                type = '\u{10FFFE}';
                srcHn = sortNormalizeHn(match[1]);
                desHn = sortNormalizeHn(match[2]);
                extra = match[3];
            } else if ( (match = reUrlRule.exec(rule)) !== null ) {
                type = '\u{10FFFF}';
                srcHn = sortNormalizeHn(match[1]);
                desHn = sortNormalizeHn(hostnameFromURI(match[2]));
                extra = match[3];
            }
            const sortType = pres.current.sortType;
            if ( sortType === 0 ) { return { rule, token: `${type} ${srcHn} ${desHn} ${extra}` }; }
            if ( sortType === 1 ) { return { rule, token: `${srcHn} ${type} ${desHn} ${extra}` }; }
            return { rule, token: `${desHn} ${type} ${srcHn} ${extra}` };
        };
        const sort = (rules: string[]) => {
            const slots = rules.map(slotFromRule);
            slots.sort((a, b) => a.token.localeCompare(b.token));
            for ( let i = 0; i < rules.length; i++ ) { rules[i] = slots[i].rule; }
        };
        const { orig, edit } = panes.current;
        orig.modified = orig.original.slice();
        edit.modified = edit.original.slice();
        for ( const pane of [ orig, edit ] ) {
            const mode = pane.doc.getMode();
            mode.sortType = pres.current.sortType;
            mode.setHostnameToDomainMap?.(hostnameToDomainMap.current);
            mode.setPSL?.(publicSuffixList);
        }
        sort(orig.modified);
        sort(edit.modified);
        if ( pres.current.isCollapsed ) {
            const diffs = getDiffer().diff_main(orig.modified.join('\n'), edit.modified.join('\n'));
            const ll: string[] = []; let lellipsis = false;
            const rr: string[] = []; let rellipsis = false;
            for ( const diff of diffs ) {
                if ( diff[0] === 0 ) { lellipsis = rellipsis = true; continue; }
                if ( diff[0] < 0 ) {
                    if ( lellipsis ) {
                        ll.push('...');
                        if ( rellipsis ) { rr.push('...'); }
                        lellipsis = rellipsis = false;
                    }
                    ll.push(diff[1].trim());
                    continue;
                }
                if ( rellipsis ) {
                    rr.push('...');
                    if ( lellipsis ) { ll.push('...'); }
                    lellipsis = rellipsis = false;
                }
                rr.push(diff[1].trim());
            }
            if ( lellipsis ) { ll.push('...'); }
            if ( rellipsis ) { rr.push('...'); }
            orig.modified = ll;
            edit.modified = rr;
        }
        rulesToDoc(clearHistory);
        onTextChanged(clearHistory);
    }, [ merge, rulesToDoc, onTextChanged ]);

    const toggleOverlay = useCallback(() => {
        if ( merge === null ) { return; }
        if ( overlay.current !== null ) {
            merge.orig.removeOverlay(overlay.current);
            merge.edit.removeOverlay(overlay.current);
            overlay.current = null;
        }
        if ( pres.current.filter !== '' ) {
            overlay.current = makeOverlay();
            merge.orig.addOverlay(overlay.current);
            merge.edit.addOverlay(overlay.current);
        }
        rulesToDoc(true);
    }, [ merge, rulesToDoc ]);

    const applyDiff = useCallback(async (permanent: boolean, toAdd: string, toRemove: string) => {
        const details = await send<RulesResponse>('dashboard', { what: 'modifyRuleset', permanent, toAdd, toRemove });
        if ( panes.current === null ) { return; }
        panes.current.orig.original = details.permanentRules;
        panes.current.edit.original = details.sessionRules;
        onPresentationChanged(false);
    }, [ onPresentationChanged ]);

    // Wire the merge view once: per-hunk arrows, diff updates, initial load.
    useEffect(() => {
        if ( merge === null ) { return; }
        panes.current = {
            orig: { doc: merge.orig, original: [], modified: [] },
            edit: { doc: merge.edit, original: [], modified: [] },
        };
        // CodeMirror quirk: fromStart.ch / toStart.ch can be undefined.
        merge.mv.options.revertChunk = (mv, from, fromStart, fromEnd, to, toStart, toEnd) => {
            if ( document.body.getAttribute('dir') === 'rtl' ) {
                let tmp: CMPane | CMPosition = from; from = to; to = tmp as CMPane;
                tmp = fromStart; fromStart = toStart; toStart = tmp as CMPosition;
                tmp = fromEnd; fromEnd = toEnd; toEnd = tmp as CMPosition;
            }
            if ( typeof fromStart.ch !== 'number' ) { fromStart.ch = 0; }
            if ( fromEnd.ch !== 0 ) { fromEnd.line += 1; }
            const toAdd = from.getRange({ line: fromStart.line, ch: 0 }, { line: fromEnd.line, ch: 0 });
            if ( typeof toStart.ch !== 'number' ) { toStart.ch = 0; }
            if ( toEnd.ch !== 0 ) { toEnd.line += 1; }
            const toRemove = to.getRange({ line: toStart.line, ch: 0 }, { line: toEnd.line, ch: 0 });
            applyDiff(from === mv.editor(), toAdd, toRemove);
        };
        const onUpdateDiff = () => { onTextChanged(); };
        merge.edit.on('updateDiff', onUpdateDiff);

        let disposed = false;
        (async () => {
            const saved = await storage.get<Partial<PresentationState>>('dynaRulesPresentationState');
            if ( disposed ) { return; }
            const next = { ...pres.current };
            if ( saved instanceof Object ) {
                if ( typeof saved.sortType === 'number' ) { next.sortType = saved.sortType; }
                if ( typeof saved.isCollapsed === 'boolean' ) { next.isCollapsed = saved.isCollapsed; }
                if ( typeof saved.filter === 'string' ) { next.filter = saved.filter; }
            }
            pres.current = next;
            setPresentation(next);
            if ( next.filter !== '' ) { toggleOverlay(); }
            const details = await send<RulesResponse>('dashboard', { what: 'getRules' });
            if ( disposed || panes.current === null ) { return; }
            panes.current.orig.original = details.permanentRules;
            panes.current.edit.original = details.sessionRules;
            publicSuffixList.fromSelfie(details.pslSelfie);
            onPresentationChanged(true);
            setLoaded(true);
        })();
        return () => {
            disposed = true;
            merge.edit.off('updateDiff', onUpdateDiff);
            if ( textTimer.current !== undefined ) { self.cancelIdleCallback(textTimer.current); }
            if ( filterTimer.current !== undefined ) { self.cancelIdleCallback(filterTimer.current); }
        };
    }, [ merge, applyDiff, onPresentationChanged, onTextChanged, toggleOverlay ]);

    const editSave = useCallback(() => {
        if ( merge === null ) { return; }
        const editText = merge.edit.getValue().trim();
        if ( editText === cleanEditText.current ) { onTextChanged(true); return; }
        const toAdd: string[] = [], toRemove: string[] = [];
        for ( const diff of getDiffer().diff_main(cleanEditText.current, editText) ) {
            if ( diff[0] === 1 ) { toAdd.push(diff[1]); } else if ( diff[0] === -1 ) { toRemove.push(diff[1]); }
        }
        applyDiff(false, toAdd.join(''), toRemove.join(''));
    }, [ merge, applyDiff, onTextChanged ]);

    // Ctrl+S saves only while editing, as upstream.
    useEffect(() => {
        CodeMirror.commands.save = isClean ? (() => {}) : () => { editSave(); };
    }, [ isClean, editSave ]);

    // Dashboard shell + cloud widget contracts.
    useEffect(() => {
        self.hasUnsavedData = () => merge !== null && merge.edit.isClean(cleanEditToken.current) === false;
        self.wikilink = 'https://github.com/gorhill/uBlock/wiki/Dashboard:-My-rules';
        const cloud = self.cloud;
        if ( cloud === undefined ) { return; }
        cloud.onPush = () => panes.current?.orig.original.join('\n') ?? '';
        cloud.onPull = (data, append) => {
            if ( typeof data !== 'string' || merge === null ) { return; }
            applyDiff(false, data, append ? '' : merge.edit.getValue().trim());
        };
        return () => { cloud.onPush = null; cloud.onPull = null; };
    }, [ merge, applyDiff ]);

    const setFilter = useCallback((value: string) => {
        setPresentation(prev => ({ ...prev, filter: value }));
        if ( filterTimer.current !== undefined ) { self.cancelIdleCallback(filterTimer.current); }
        filterTimer.current = self.requestIdleCallback(() => {
            filterTimer.current = undefined;
            if ( merge === null ) { return; }
            if ( merge.edit.isClean(cleanEditToken.current) === false ) { return; }
            if ( value === pres.current.filter ) { return; }
            savePresentation({ ...pres.current, filter: value });
            toggleOverlay();
        }, { timeout: 773 });
    }, [ merge, toggleOverlay ]);

    const setSortType = useCallback((value: number) => {
        savePresentation({ ...pres.current, sortType: value });
        onPresentationChanged(true);
    }, [ onPresentationChanged ]);

    const toggleCollapsed = useCallback(() => {
        savePresentation({ ...pres.current, isCollapsed: pres.current.isCollapsed === false });
        onPresentationChanged(true);
    }, [ onPresentationChanged ]);

    const importFile = useCallback((file: File) => {
        if ( file.name === '' || file.type.indexOf('text') !== 0 ) { return; }
        const fr = new FileReader();
        fr.onload = () => {
            if ( typeof fr.result !== 'string' || fr.result === '' ) { return; }
            // https://github.com/chrisaljoudi/uBlock/issues/757: RequestPolicy syntax
            let result = fr.result;
            const matches = /\[origins-to-destinations\]([^[]+)/.exec(result);
            if ( matches && matches.length === 2 ) {
                result = matches[1].trim().replace(/\|/g, ' ').replace(/\n/g, ' * noop\n');
            }
            applyDiff(false, result, '');
        };
        fr.readAsText(file);
    }, [ applyDiff ]);

    const exportFile = useCallback(() => {
        if ( merge === null ) { return; }
        const filename = t('rulesDefaultFileName')
            .replace('{{datetime}}', uBlockDashboard.dateNowToSensibleString())
            .replace(/ +/g, '_');
        const details = {
            url: 'data:text/plain,' + encodeURIComponent(merge.orig.getValue().trim() + '\n'),
            filename,
            saveAs: true,
        };
        vAPI.download(details);
    }, [ merge ]);

    const revertAll = useCallback(() => {
        if ( merge === null ) { return; }
        const toAdd: string[] = [], toRemove: string[] = [];
        for ( const chunk of merge.mv.leftChunks() ) {
            toAdd.push(merge.orig.getRange({ line: chunk.origFrom, ch: 0 }, { line: chunk.origTo, ch: 0 }).trim());
            toRemove.push(merge.edit.getRange({ line: chunk.editFrom, ch: 0 }, { line: chunk.editTo, ch: 0 }).trim());
        }
        applyDiff(false, toAdd.join('\n'), toRemove.join('\n'));
    }, [ merge, applyDiff ]);

    const commitAll = useCallback(() => {
        if ( merge === null ) { return; }
        const toAdd: string[] = [], toRemove: string[] = [];
        for ( const chunk of merge.mv.leftChunks() ) {
            toAdd.push(merge.edit.getRange({ line: chunk.editFrom, ch: 0 }, { line: chunk.editTo, ch: 0 }).trim());
            toRemove.push(merge.orig.getRange({ line: chunk.origFrom, ch: 0 }, { line: chunk.origTo, ch: 0 }).trim());
        }
        applyDiff(true, toAdd.join('\n'), toRemove.join('\n'));
    }, [ merge, applyDiff ]);

    const state: DynaRulesState = {
        loaded, isClean, isDirty,
        sortType: presentation.sortType, isCollapsed: presentation.isCollapsed, filter: presentation.filter,
    };
    const actions: DynaRulesActions = {
        setFilter, setSortType, toggleCollapsed, importFile, exportFile, revertAll, commitAll, editSave,
    };
    return [ state, actions ];
}

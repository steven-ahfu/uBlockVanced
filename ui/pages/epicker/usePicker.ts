import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    candidatePathsForSlot,
    reCosmeticAnchor,
    splitBodyMarker,
    userFilterFromCandidate,
} from '../../../src/js/epicker-model.js';
import type { ProbeFacts, ProceduralSuggestion } from '../../../src/js/element-probe/procedural-suggest.js';
import { AstFilterParser } from '../../../src/js/static-filtering-parser.js';
import { hostnameFromURI } from '../../../src/js/uri-utils.js';
import { suggestProceduralFilters } from '../../../src/js/element-probe/procedural-suggest.js';
import punycode from '../../../src/lib/punycode.js';

// The dialog talks to the page-side picker (js/scriptlets/epicker.js) over a
// MessageChannel port handed to it in an `epickerStart` window message. The
// protocol is unchanged from the pre-React dialog; only the rendering moved.

const NO_PATHS = 'M0 0';

export type PickerMode = 'classic' | 'probe';

export interface PickerState {
    ready: boolean;
    zap: boolean;
    paused: boolean;
    preview: boolean;
    minimized: boolean;
    shown: boolean;            // touch: dialog forced visible over the page
    hidden: boolean;           // touch: dialog swiped away
    mode: PickerMode;
    netFilters: string[];
    cosmeticFilters: string[];
    selectedNet: number;
    selectedCosmetic: number;
    depth: number;
    specificity: number;
    showModifiers: boolean;
    resultsetCount: string;
    createDisabled: boolean;
    invalidFilter: boolean;
    probeSuggestions: ProceduralSuggestion[];
    selectedProbe: number;
    ocean: string;
    islands: string;
}

export interface PickerActions {
    setMode(mode: PickerMode): void;
    chooseNet(index: number): void;
    chooseCosmetic(index: number): void;
    chooseProbe(index: number): void;
    setDepth(value: number): void;
    setSpecificity(value: number): void;
    pick(): void;
    togglePreview(): void;
    create(): void;
    quit(): void;
    toggleMinimize(): void;
    onSvgClick(ev: { clientX: number; clientY: number; ctrlKey?: boolean; onIslands: boolean; touch?: boolean }): void;
    onSwipe(direction: 'left' | 'right'): void;
    onEditorChanged(text: string): void;
    registerEditor(handle: { setText(text: string): void; getText(): string }): void;
}

interface Port {
    postMessage(msg: Record<string, unknown>): void;
    close(): void;
    onmessage: ((ev: MessageEvent) => void) | null;
    onmessageerror: (() => void) | null;
}

export function usePicker(): [ PickerState, PickerActions ] {
    const [ state, setState ] = useState<PickerState>({
        ready: false,
        zap: document.documentElement.classList.contains('zap'),
        paused: false,
        preview: false,
        minimized: true,
        shown: false,
        hidden: false,
        mode: 'classic',
        netFilters: [],
        cosmeticFilters: [],
        selectedNet: -1,
        selectedCosmetic: -1,
        depth: 7,
        specificity: 6,
        showModifiers: false,
        resultsetCount: '',
        createDisabled: true,
        invalidFilter: false,
        probeSuggestions: [],
        selectedProbe: -1,
        ocean: NO_PATHS,
        islands: NO_PATHS,
    });

    const patch = useCallback((next: Partial<PickerState>) => {
        setState(prev => ({ ...prev, ...next }));
    }, []);

    // Everything the message handlers need but must not re-subscribe on.
    const port = useRef<Port | null>(null);
    const editor = useRef<{ setText(text: string): void; getText(): string } | null>(null);
    const parser = useRef<AstFilterParser | null>(null);
    const docURL = useRef(new URL(self.location.href));
    const resultsetOpt = useRef<string | undefined>(undefined);
    const computedCandidate = useRef('');
    const computedBySlot = useRef(new Map<number, string[][]>());
    const cosmetic = useRef<{ filters: string[]; needBody: boolean }>({ filters: [], needBody: false });
    const probeFacts = useRef<ProbeFacts | null>(null);
    const live = useRef(state);
    live.current = state;

    const post = useCallback((msg: Record<string, unknown>) => {
        port.current?.postMessage(msg);
    }, []);

    /* The filter text -------------------------------------------------- */

    // The editor is a one-line field that happens to be CodeMirror, so only
    // the first line counts. `!` is the sentinel for "not a usable filter",
    // and the validity chain is upstream's: it must parse as a filter, and be
    // either a cosmetic filter or a network one.
    const parseFilter = useCallback((raw: string): { filter: string; compiled?: string } => {
        const eol = raw.indexOf('\n');
        const text = eol === -1 ? raw : raw.slice(0, eol);
        if ( text === '' ) { return { filter: '' }; }
        const p = parser.current;
        if ( p === null ) { return { filter: text }; }
        p.parse(text);
        if ( p.isFilter() === false ) { return { filter: '!' }; }
        if ( p.isExtendedFilter() ) {
            if ( p.isCosmeticFilter() === false ) { return { filter: '!' }; }
        } else if ( p.isNetworkFilter() === false ) {
            return { filter: '!' };
        }
        return {
            filter: text,
            compiled: reCosmeticAnchor.test(text) ? p.result.compiled : undefined,
        };
    }, []);

    const onEditorChanged = useCallback((text: string) => {
        const { filter, compiled } = parseFilter(text);
        const bad = filter === '!';
        setState(prev => ({
            ...prev,
            invalidFilter: bad,
            resultsetCount: bad ? 'E' : prev.resultsetCount,
            createDisabled: bad ? true : prev.createDisabled,
            // The sliders describe the computed candidate; once the user edits
            // the text by hand they no longer describe what is in the box.
            showModifiers: text !== '' && text.trim() === computedCandidate.current,
        }));
        post({ what: 'dialogSetFilter', filter, compiled });
    }, [ parseFilter, post ]);

    const setEditorText = useCallback((text: string) => {
        editor.current?.setText(text);
        onEditorChanged(text);
    }, [ onEditorChanged ]);

    /* Candidate selection ---------------------------------------------- */

    const requestCosmetic = useCallback((slot: number) => {
        const cached = computedBySlot.current.get(slot);
        if ( cached !== undefined ) {
            const i = live.current.specificity;
            computedCandidate.current = cached[i].join('');
            setEditorText(computedCandidate.current);
            patch({ showModifiers: true });
            return;
        }
        const candidates = candidatePathsForSlot(
            cosmetic.current.filters, slot, cosmetic.current.needBody
        );
        post({ what: 'optimizeCandidates', candidates, slot });
    }, [ patch, post, setEditorText ]);

    const chooseCosmetic = useCallback((index: number) => {
        patch({
            selectedCosmetic: index,
            selectedNet: -1,
            selectedProbe: -1,
            depth: index,
        });
        requestCosmetic(index);
    }, [ patch, requestCosmetic ]);

    const chooseNet = useCallback((index: number) => {
        const filter = live.current.netFilters[index];
        if ( filter === undefined ) { return; }
        computedCandidate.current = '';
        patch({ selectedNet: index, selectedCosmetic: -1, selectedProbe: -1, showModifiers: false });
        setEditorText(filter);
    }, [ patch, setEditorText ]);

    const chooseProbe = useCallback((index: number) => {
        const suggestion = live.current.probeSuggestions[index];
        if ( suggestion === undefined ) { return; }
        // A procedural filter is a cosmetic filter: it takes the `##` anchor
        // and picks up the hostname in userFilterFromCandidate() like any other.
        computedCandidate.current = '';
        patch({ selectedProbe: index, selectedNet: -1, selectedCosmetic: -1, showModifiers: false });
        setEditorText(`##${suggestion.filter}`);
    }, [ patch, setEditorText ]);

    const setDepth = useCallback((value: number) => {
        patch({ depth: value });
        chooseCosmetic(value);
    }, [ chooseCosmetic, patch ]);

    const setSpecificity = useCallback((value: number) => {
        patch({ specificity: value });
        const slot = live.current.selectedCosmetic;
        const cached = computedBySlot.current.get(slot);
        if ( cached === undefined ) { return; }
        computedCandidate.current = cached[value].join('');
        setEditorText(computedCandidate.current);
        patch({ showModifiers: true });
    }, [ patch, setEditorText ]);

    /* Picker lifecycle -------------------------------------------------- */

    const pausePicker = useCallback(() => {
        patch({ paused: true, minimized: false });
    }, [ patch ]);

    const unpausePicker = useCallback(() => {
        patch({ paused: false, preview: false, minimized: true });
        post({ what: 'togglePreview', state: false });
    }, [ patch, post ]);

    const quit = useCallback(() => {
        post({ what: 'quitPicker' });
        port.current?.close();
        port.current = null;
    }, [ post ]);

    const togglePreview = useCallback(() => {
        const next = live.current.preview === false;
        patch({ preview: next });
        post({ what: 'togglePreview', state: next });
    }, [ patch, post ]);

    const create = useCallback(() => {
        const raw = editor.current?.getText() ?? '';
        const { filter, compiled } = parseFilter(raw);
        let hn = hostnameFromURI(docURL.current.href);
        if ( hn.startsWith('xn--') ) { hn = punycode.toUnicode(hn); }
        const line = userFilterFromCandidate(filter, hn, resultsetOpt.current);
        if ( line !== undefined ) {
            void vAPI.messaging.send('elementPicker', {
                what: 'createUserFilter',
                autoComment: true,
                filters: line,
                docURL: docURL.current.href,
                killCache: reCosmeticAnchor.test(filter) === false,
            });
        }
        post({ what: 'dialogCreate', filter, compiled });
    }, [ parseFilter, post ]);

    const toggleMinimize = useCallback(() => {
        if ( live.current.paused === false ) {
            pausePicker();
            onEditorChanged(editor.current?.getText() ?? '');
            return;
        }
        patch({ minimized: live.current.minimized === false });
    }, [ onEditorChanged, patch, pausePicker ]);

    const onSvgClick = useCallback((ev: {
        clientX: number; clientY: number; ctrlKey?: boolean; onIslands: boolean; touch?: boolean;
    }) => {
        if ( live.current.zap ) {
            post({
                what: 'zapElementAtPoint',
                mx: ev.clientX,
                my: ev.clientY,
                options: { stay: true, highlight: ev.onIslands === false },
            });
            return;
        }
        // Clicking outside the dialog resumes picking, unless a preview is up.
        if ( live.current.paused ) {
            if ( live.current.preview === false ) { unpausePicker(); }
            return;
        }
        if ( ev.touch ) { patch({ shown: true }); }
        post({
            what: 'filterElementAtPoint',
            mx: ev.clientX,
            my: ev.clientY,
            broad: ev.ctrlKey === true,
        });
    }, [ patch, post, unpausePicker ]);

    // Touch has no hover, so the dialog is swiped in and out of the way
    // instead. Left brings it back; right puts it away, or quits when there is
    // nothing left to put away.
    const onSwipe = useCallback((direction: 'left' | 'right') => {
        if ( direction === 'left' ) {
            if ( live.current.paused ) { patch({ hidden: false, shown: true }); }
            return;
        }
        if ( live.current.zap && live.current.islands !== NO_PATHS ) {
            post({ what: 'unhighlight' });
            return;
        }
        if ( live.current.paused && live.current.shown ) {
            patch({ shown: false, hidden: true });
            return;
        }
        quit();
    }, [ patch, post, quit ]);

    /* Incoming messages -------------------------------------------------- */

    const showDialog = useCallback((msg: {
        url: string;
        netFilters: string[];
        cosmeticFilters: string[];
        filter?: { filters: string[]; slot: number } | null;
        probeFacts?: ProbeFacts | null;
    }) => {
        pausePicker();
        docURL.current = new URL(msg.url);
        cosmetic.current = splitBodyMarker(msg.cosmeticFilters);
        computedBySlot.current.clear();
        computedCandidate.current = '';
        probeFacts.current = msg.probeFacts ?? null;

        const suggestions = probeFacts.current !== null
            ? suggestProceduralFilters(probeFacts.current)
            : [];

        patch({
            netFilters: msg.netFilters,
            cosmeticFilters: cosmetic.current.filters,
            probeSuggestions: suggestions,
            selectedProbe: -1,
            selectedNet: -1,
            selectedCosmetic: -1,
            // A fresh pick is about this element, so the tab resets with it.
            mode: 'classic',
            createDisabled: true,
            depth: Math.max(0, cosmetic.current.filters.length - 1),
            showModifiers: false,
        });

        if ( msg.filter === undefined || msg.filter === null ) {
            setEditorText('');
            return;
        }
        const { slot, filters } = msg.filter;
        const chosen = filters[slot];
        if ( chosen === undefined ) { return; }
        if ( chosen.startsWith('##') === false ) {
            patch({ selectedNet: slot });
            setEditorText(chosen);
            return;
        }
        patch({ selectedCosmetic: slot, depth: slot });
        requestCosmetic(slot);
    }, [ patch, pausePicker, requestCosmetic, setEditorText ]);

    const onMessage = useCallback((msg: Record<string, any>) => {
        switch ( msg.what ) {
        case 'candidatesOptimized': {
            if ( Array.isArray(msg.candidates) ) {
                computedBySlot.current.set(msg.slot, msg.candidates);
            }
            const paths = computedBySlot.current.get(msg.slot);
            if ( paths === undefined ) { return; }
            const i = live.current.specificity;
            computedCandidate.current = paths[i].join('');
            setEditorText(computedCandidate.current);
            patch({ showModifiers: true });
            break;
        }
        case 'showDialog':
            showDialog(msg as Parameters<typeof showDialog>[0]);
            break;
        case 'resultsetDetails':
            resultsetOpt.current = msg.opt;
            patch({ resultsetCount: `${msg.count}`, createDisabled: msg.count === 0 });
            break;
        case 'svgPaths': {
            const islands: string = msg.islands || '';
            patch({
                ocean: `${msg.ocean}${islands}`,
                islands: islands || NO_PATHS,
            });
            break;
        }
        default:
            break;
        }
    }, [ patch, setEditorText, showDialog ]);

    /* The handshake ------------------------------------------------------ */

    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        const onStart = (ev: MessageEvent) => {
            const msg = ev.data || {};
            if ( msg.what !== 'epickerStart' ) { return; }
            if ( Array.isArray(ev.ports) === false || ev.ports.length === 0 ) { return; }
            const p = ev.ports[0] as unknown as Port;
            port.current = p;
            p.onmessage = e => { onMessageRef.current((e.data || {}) as Record<string, unknown>); };
            p.onmessageerror = () => { quit(); };
            parser.current = new AstFilterParser({
                interactive: true,
                nativeCssHas: vAPI.webextFlavor.env.includes('native_css_has'),
            });
            setState(prev => ({ ...prev, ready: true, paused: false, minimized: true }));
            p.postMessage({ what: 'togglePreview', state: false });
            p.postMessage({ what: 'start' });
        };
        self.addEventListener('message', onStart, { once: true });
        return () => { self.removeEventListener('message', onStart); };
    }, [ quit ]);

    // Escape quits, as it always has.
    useEffect(() => {
        const onKey = (ev: KeyboardEvent) => {
            if ( ev.key !== 'Escape' && ev.which !== 27 ) { return; }
            ev.stopPropagation();
            ev.preventDefault();
            quit();
        };
        self.addEventListener('keydown', onKey, true);
        return () => { self.removeEventListener('keydown', onKey, true); };
    }, [ quit ]);

    // While picking (not paused) the page highlights whatever is under the
    // cursor. Throttled to one message per frame, as upstream did.
    useEffect(() => {
        if ( state.paused || state.ready === false ) { return; }
        let timer = 0;
        let mx = 0, my = 0;
        const fire = () => {
            timer = 0;
            post({ what: 'highlightElementAtPoint', mx, my });
        };
        const onHover = (ev: MouseEvent) => {
            mx = ev.clientX; my = ev.clientY;
            if ( timer === 0 ) { timer = self.requestAnimationFrame(fire); }
        };
        document.addEventListener('mousemove', onHover, { passive: true });
        return () => {
            document.removeEventListener('mousemove', onHover);
            if ( timer !== 0 ) { self.cancelAnimationFrame(timer); }
        };
    }, [ post, state.paused, state.ready ]);

    // The stylesheet keys its layout on these, exactly as the upstream dialog
    // did, so they are mirrored onto the root element rather than replaced.
    useEffect(() => {
        const cl = document.documentElement.classList;
        cl.toggle('paused', state.paused);
        cl.toggle('preview', state.preview);
        cl.toggle('minimized', state.minimized);
        cl.toggle('show', state.shown);
        cl.toggle('hide', state.hidden);
        cl.toggle('probeMode', state.mode === 'probe');
    }, [ state.paused, state.preview, state.minimized, state.shown, state.hidden, state.mode ]);

    const actions = useMemo<PickerActions>(() => ({
        setMode: mode => patch({ mode }),
        chooseNet,
        chooseCosmetic,
        chooseProbe,
        setDepth,
        setSpecificity,
        pick: unpausePicker,
        togglePreview,
        create,
        quit,
        toggleMinimize,
        onSvgClick,
        onSwipe,
        onEditorChanged,
        registerEditor: handle => { editor.current = handle; },
    }), [
        chooseCosmetic, chooseNet, chooseProbe, create, onEditorChanged, onSvgClick,
        onSwipe, patch, quit, setDepth, setSpecificity, toggleMinimize, togglePreview,
        unpausePicker,
    ]);

    return [ state, actions ];
}

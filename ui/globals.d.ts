// Globals provided by the upstream scripts loaded before the bundle
// (js/vapi.js, js/vapi-common.js, js/vapi-client.js).
declare const vAPI: {
    messaging: { send(channel: string, msg: Record<string, unknown>): Promise<any> };
    download(details: { url: string; filename: string }): void;
    localStorage: {
        getItemAsync(key: string): Promise<unknown>;
        setItem(key: string, value: unknown): void;
        removeItem(key: string): void;
    };
    closePopup(): void;
    webextFlavor: { soup: Set<string>; env: string[] };
    defer: { create(fn: () => void): { on(ms: number): void; off(): void } };
};

declare const chrome: { i18n: { getMessage(key: string): string } };
declare const browser: { i18n: { getMessage(key: string): string } } | undefined;

declare module '*.svg' {
    const content: string;
    export default content;
}

declare module '*.css';

declare module '*/punycode.js' {
    const punycode: {
        toUnicode(input: string): string;
        toASCII(input: string): string;
    };
    export default punycode;
}

// CodeMirror 5 (src/lib/codemirror) and the upstream dashboard helpers
// (src/js/dashboard-common.js), both loaded as page scripts before the bundle.
// Only the surface the React pages use is typed.
interface CMPosition { line: number; ch: number }
interface CMDoc {
    getValue(): string;
    getHistory(): unknown;
    setHistory(h: unknown): void;
    listSelections(): Array<{ anchor: CMPosition; head: CMPosition }>;
    setSelections(s: Array<{ anchor: CMPosition; head: CMPosition }>): void;
    replaceRange(text: string, from: CMPosition, to: CMPosition): void;
    lineCount(): number;
}
interface CMEditor {
    getValue(): string;
    setValue(text: string): void;
    getOption(name: string): any;
    setOption(name: string, value: unknown): void;
    getDoc(): CMDoc;
    getCursor(): CMPosition;
    setCursor(line: number | CMPosition, ch?: number): void;
    focus(): void;
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
    operation(fn: () => void): void;
    startOperation(): void;
    endOperation(): void;
    clearHistory(): void;
    getScrollInfo(): { left: number; top: number };
    scrollTo(left: number, top: number): void;
    listSelections(): Array<{ anchor: CMPosition; head: CMPosition }>;
    setSelection(anchor: CMPosition, head: CMPosition): void;
    lineCount(): number;
    getLine(n: number): string;
    addLineClass(line: number, where: string, cls: string): void;
    removeLineClass(line: number, where: string, cls?: string): void;
    refresh(): void;
}
declare const CodeMirror: {
    new (host: HTMLElement, options: Record<string, unknown>): CMEditor;
    commands: Record<string, (cm: CMEditor) => void>;
};
declare const uBlockDashboard: {
    patchCodeMirrorEditor(cm: CMEditor): void;
    mergeNewLines(text: string, newText: string): string;
    dateNowToSensibleString(): string;
};
declare const diff_match_patch: new () => {
    diff(a: string[], b: string[]): Array<[ number, string ]>;
};

// Pure upstream modules the React pages import directly (no DOM, no vAPI).
declare module '*/src/js/filter-export.js' {
    export function parseFilterExportText(text: string): { rules: unknown[]; unassignedNotes: string[] };
    export function normalizeFilterImportText(text: string): { text: string; notes: string[] };
}
declare module '*/src/js/user-filters.js' {
    export function normalizeHostname(value: string): string | undefined;
}
declare module '*/src/js/epicker-model.js' {
    export const SPECIFICITIES: readonly number[];
    export const reCosmeticAnchor: RegExp;
    export function candidatePathsForSlot(
        filters: string[], slot: number, needBody: boolean
    ): string[][];
    export function userFilterFromCandidate(
        filter: string, hostname: string, resultsetOpt: string | undefined
    ): string | undefined;
    export function optimizedCandidate(candidates: string[], index: number): string;
    export function splitBodyMarker(
        cosmeticFilters: string[]
    ): { filters: string[]; needBody: boolean };
}
declare module '*/src/js/element-probe/procedural-suggest.js' {
    export interface ProceduralSuggestion {
        type: string;
        label: string;
        filter: string;
        description: string;
        score: number;
    }
    export interface ProbeFacts {
        tag: string;
        id?: string;
        classes?: string[];
        text?: string;
        textContent?: string;
        path?: string;
        ancestors?: Array<{ tag: string; id?: string; classes?: string[] }>;
    }
    export function suggestProceduralFilters(facts: ProbeFacts | null): ProceduralSuggestion[];
    export function isGeneratedId(id: string): boolean;
}
declare module '*/src/js/epicker-refine.js' {
    export interface Refinement { label: string; suffix: string; description: string }
    export function refinementsFor(
        filter: string, facts?: unknown, matchCount?: number
    ): Refinement[];
    export function applyRefinement(filter: string, suffix: string): string;
}
declare module '*/src/js/uri-utils.js' {
    export function hostnameFromURI(uri: string): string;
}
declare module '*/src/js/static-filtering-parser.js' {
    export class AstFilterParser {
        constructor(options: Record<string, unknown>);
        parse(raw: string): void;
        isFilter(): boolean;
        isExtendedFilter(): boolean;
        isCosmeticFilter(): boolean;
        isNetworkFilter(): boolean;
        hasError(): boolean;
        result: { exception: boolean; raw: string; compiled: string };
    }
}

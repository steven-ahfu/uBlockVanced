// Page-local types: the CodeMirror MergeView surface the My rules page uses,
// plus the two pure upstream modules it imports.

interface CMMark { clear(): void; uboEllipsis?: boolean }

interface CMMode {
    sortType?: number;
    setHostnameToDomainMap?(map: Map<string, string>): void;
    setPSL?(psl: unknown): void;
}

interface CMPane extends CMEditor {
    getRange(from: CMPosition, to: CMPosition): string;
    posFromIndex(index: number): CMPosition;
    replaceRange(text: string, from: CMPosition, to: CMPosition): void;
    getAllMarks(): CMMark[];
    markText(from: CMPosition, to: CMPosition, opts: { atomic?: boolean; readOnly?: boolean }): CMMark;
    addOverlay(mode: unknown): void;
    removeOverlay(mode: unknown): void;
    getMode(): CMMode;
    changeGeneration(): number;
    isClean(generation?: number): boolean;
    scrollIntoView(pos: CMPosition, margin?: number): void;
    defaultTextHeight(): number;
    getScrollInfo(): { left: number; top: number; clientHeight: number };
}

interface CMChunk { origFrom: number; origTo: number; editFrom: number; editTo: number }

interface CMMergeView {
    editor(): CMPane;
    leftOriginal(): CMPane;
    leftChunks(): CMChunk[];
    options: {
        revertChunk?: (
            mv: CMMergeView,
            from: CMPane, fromStart: CMPosition, fromEnd: CMPosition,
            to: CMPane, toStart: CMPosition, toEnd: CMPosition,
        ) => void;
    };
}

type CMMergeViewCtor = new (host: HTMLElement, options: Record<string, unknown>) => CMMergeView;

interface CMStream { pos: number; string: string; skipToEnd(): void }

declare module '*/src/js/uri-utils.js' {
    export function hostnameFromURI(uri: string): string;
}

declare module '*/src/lib/publicsuffixlist/publicsuffixlist.js' {
    const publicSuffixList: {
        getDomain(hostname: string): string;
        fromSelfie(selfie: unknown, decoder?: unknown): boolean;
    };
    export default publicSuffixList;
}

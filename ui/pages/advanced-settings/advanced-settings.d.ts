// CodeMirror surface this page uses beyond ui/globals.d.ts: read-only ranges
// for admin-locked lines (interface merge) and the stream a custom mode sees.
interface CMStream {
    sol(): boolean;
    eatSpace(): boolean;
    match(pattern: RegExp | string): RegExpMatchArray | null;
    skipToEnd(): void;
}

interface CMEditor {
    markText(from: CMPosition, to: CMPosition, options: { readOnly?: boolean }): { clear(): void };
}

interface CMWithModes {
    defineMode(name: string, factory: () => { token(stream: CMStream): string | null }): void;
}

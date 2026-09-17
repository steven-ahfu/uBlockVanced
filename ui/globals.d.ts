// Globals provided by the upstream scripts loaded before the bundle
// (js/vapi.js, js/vapi-common.js, js/vapi-client.js).
declare const vAPI: {
    messaging: { send(channel: string, msg: Record<string, unknown>): Promise<any> };
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

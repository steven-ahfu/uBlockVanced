// Element Probe panel: the browser APIs this page talks to directly.
//
// AGENTS.md makes the panel the documented exception to "no chrome.* in
// shared code" — chrome.devtools.* has no vAPI wrapper. ui/globals.d.ts
// types the `chrome` global as the i18n surface only, so the panel casts it
// once (see useProbe.ts) to the richer shape below.

interface ProbeEvalOptions { frameURL?: string }

interface ProbeEvent<T extends unknown[]> {
    addListener(callback: (...args: T) => void): void;
}

interface ProbeChrome {
    devtools: {
        inspectedWindow: {
            eval(
                code: string,
                options: ProbeEvalOptions | undefined,
                callback: (result: unknown, error?: unknown) => void,
            ): void;
            onNavigated?: ProbeEvent<[]>;
        };
        panels?: {
            elements?: { onSelectionChanged: ProbeEvent<[]> };
        };
    };
    runtime: {
        lastError?: { message?: string };
        sendMessage(message: unknown, callback: (response: unknown) => void): void;
    };
    storage: {
        local: {
            get(keys: string): Promise<Record<string, unknown>>;
            get(keys: string, callback: (items: Record<string, unknown>) => void): void;
            set(items: Record<string, unknown>): Promise<void>;
        };
    };
}

// src/js/element-probe/page-scripts.js: pure string templates evaluated in the
// inspected page. No DOM of its own, so the bundle imports it as-is.
declare module '*/src/js/element-probe/page-scripts.js' {
    export const DEFAULT_CLASS_PATTERNS: string[];
    export function buildInspectScript(patterns: string[]): string;
    export const HIGHLIGHT_SCRIPT: (selector: string) => string;
    export const REMOVE_HIGHLIGHT_SCRIPT: string;
    export const PROCEDURAL_HIGHLIGHT_SCRIPT: (proceduralSelector: string) => string;
    export const HIDE_ELEMENT_SCRIPT: (selector: string) => string;
    export const SCAN_SHADOW_SCRIPT: string;
    export const SCAN_IFRAMES_SCRIPT: string;
    export const PICK_ELEMENT_SCRIPT: string;
    export const YT_SWEEP_SCRIPT: string;
}

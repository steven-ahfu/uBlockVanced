// Page-local declarations for the Settings page.

// Upstream theme helpers (src/js/theme.js). Bundling a copy is harmless: its
// load-time side effect only re-applies the already-active theme.
declare module '*/src/js/theme.js' {
    export function setTheme(theme: string, propagate?: boolean): void;
    export function setAccentColor(accentEnabled: boolean, accentColor: string, propagate: boolean, stylesheet?: string): void;
}

// src/js/dashboard-common.js: open a page in an existing tab when possible.
interface Window {
    uBlockDashboard: {
        openOrSelectPage(url: string | MouseEvent, options?: Record<string, unknown>): void;
    };
}

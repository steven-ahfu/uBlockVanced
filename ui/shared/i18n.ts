// Localized strings from the extension's _locales, through the same browser
// API the upstream i18n.js uses. Missing keys fall back to the key so a typo
// is visible instead of silent.

const cache = new Map<string, string>();

function getMessage(key: string): string {
    const api = typeof browser !== 'undefined' && browser ? browser : chrome;
    try { return api.i18n.getMessage(key) || ''; } catch { return ''; }
}

export function t(key: string): string {
    let text = cache.get(key);
    if ( text === undefined ) {
        text = getMessage(key);
        if ( text === '' ) { text = key; }
        cache.set(key, text);
    }
    return text;
}

// Some upstream messages carry light markup; the popup only needs plain text.
export function tPlain(key: string): string {
    return t(key).replace(/<[^>]+>/g, '');
}

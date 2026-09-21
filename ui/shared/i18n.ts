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

// Like t(), but returns '' for a missing key so callers can fall back.
export function tOr(key: string, fallback: string): string {
    const text = getMessage(key);
    return text === '' ? fallback : text;
}

// Some upstream messages carry light markup; the popup only needs plain text.
export function tPlain(key: string): string {
    return t(key).replace(/<[^>]+>/g, '');
}

// t() with {{name}} placeholders filled in, the way upstream messages expect.
export function tf(key: string, subs: Record<string, string | number>): string {
    let text = t(key);
    for ( const [ name, value ] of Object.entries(subs) ) {
        text = text.replace(`{{${name}}}`, typeof value === 'number' ? value.toLocaleString() : value);
    }
    return text;
}

// Same buckets and strings as upstream i18n.renderElapsedTimeToString().
export function elapsedTimeToString(tstamp: number): string {
    let value = (Date.now() - tstamp) / 60000;
    if ( value < 2 ) { return t('elapsedOneMinuteAgo'); }
    if ( value < 60 ) { return tf('elapsedManyMinutesAgo', { value: Math.floor(value) }); }
    value /= 60;
    if ( value < 2 ) { return t('elapsedOneHourAgo'); }
    if ( value < 24 ) { return tf('elapsedManyHoursAgo', { value: Math.floor(value) }); }
    value /= 24;
    if ( value < 2 ) { return t('elapsedOneDayAgo'); }
    return tf('elapsedManyDaysAgo', { value: Math.floor(value) });
}

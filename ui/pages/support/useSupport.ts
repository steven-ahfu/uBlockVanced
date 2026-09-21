import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onBroadcast } from '../../shared/broadcast';
import { send } from '../../shared/vapi';

// Upstream support.js: which keys are dropped or redacted from the report.
const uselessKeys = [
    'hiddenSettings.benchmarkDatasetURL',
    'hiddenSettings.blockingProfiles',
    'hiddenSettings.consoleLogLevel',
    'hiddenSettings.uiPopupConfig',
    'userSettings.alwaysDetachLogger',
    'userSettings.firewallPaneMinimized',
    'userSettings.externalLists',
    'userSettings.importedLists',
    'userSettings.popupPanelSections',
    'userSettings.uiAccentCustom',
    'userSettings.uiAccentCustom0',
    'userSettings.uiTheme',
];
const sensitiveValues = [
    'filterset (user)',
    'userSettings.popupPanelSections',
    'hiddenSettings.userResourcesLocation',
    'trustedset.added',
    'hostRuleset.added',
    'switchRuleset.added',
    'urlRuleset.added',
];
const sensitiveKeys = [ 'listset.added' ];

type Data = Record<string, unknown>;
const isObject = (v: unknown): v is Data => v instanceof Object;

function removeKey(data: unknown, prop: string): void {
    if ( isObject(data) === false ) { return; }
    const pos = prop.indexOf('.');
    if ( pos !== -1 ) { return removeKey(data[prop.slice(0, pos)], prop.slice(pos + 1)); }
    delete data[prop];
}

function redactValue(data: unknown, prop: string): void {
    if ( isObject(data) === false ) { return; }
    const pos = prop.indexOf('.');
    if ( pos !== -1 ) { return redactValue(data[prop.slice(0, pos)], prop.slice(pos + 1)); }
    const value = data[prop];
    if ( value === undefined ) { return; }
    if ( Array.isArray(value) ) {
        data[prop] = value.length !== 0 ? `[array of ${value.length} redacted]` : '[empty]';
    } else {
        data[prop] = '[redacted]';
    }
}

function redactKeys(data: unknown, prop: string): void {
    if ( isObject(data) === false ) { return; }
    const pos = prop.indexOf('.');
    if ( pos !== -1 ) { return redactKeys(data[prop.slice(0, pos)], prop.slice(pos + 1)); }
    const obj = data[prop];
    if ( isObject(obj) === false ) { return; }
    let count = 1;
    for ( const key in obj ) {
        if ( key.startsWith('file://') === false ) { continue; }
        obj[`[list name ${count} redacted]`] = obj[key];
        obj[key] = undefined;
        count += 1;
    }
}

function patchEmptiness(data: Data, prop: string): void {
    const entry = data[prop];
    if ( Array.isArray(entry) && entry.length === 0 ) { data[prop] = '[empty]'; return; }
    if ( isObject(entry) === false ) { return; }
    if ( Object.keys(entry).length === 0 ) { data[prop] = '[none]'; return; }
    for ( const key in entry ) { patchEmptiness(entry, key); }
}

function renderData(data: unknown, depth = 0): string {
    const indent = ' '.repeat(depth);
    if ( Array.isArray(data) ) {
        return data.map(value => renderData(value, depth)).join('\n');
    }
    if ( typeof data !== 'object' || data === null ) { return `${indent}${data}`; }
    const out: string[] = [];
    for ( const [ name, value ] of Object.entries(data) ) {
        if ( typeof value === 'object' && value !== null ) {
            out.push(`${indent}${name}:`);
            out.push(renderData(value, depth + 1));
            continue;
        }
        out.push(`${indent}${name}: ${value}`);
    }
    return out.join('\n');
}

export const configToMarkdown = (text: string, collapse = false): string => {
    const t = text.trim();
    return collapse
        ? '<details>\n\n```yaml\n' + t + '\n```\n</details>'
        : '```yaml\n' + t + '\n```\n';
};

export const gotoURL = (url: string, shiftKey = false): void => {
    send('default', { what: 'gotoURL', details: { url, select: true, index: -1, shiftKey } });
};

export interface ReportedPage {
    hostname: string;
    popupPanel: unknown;
    urls: string[];
    shouldUpdateLists: string[] | null;
}

// Upstream reportedPage: when opened from the popup with ?pageURL=..., the
// page becomes a filter-issue reporter for that site.
function readReportedPage(): ReportedPage | null {
    const url = new URL(self.location.href);
    try {
        const pageURL = url.searchParams.get('pageURL');
        if ( pageURL === null ) { return null; }
        const parsedURL = new URL(pageURL);
        parsedURL.username = '';
        parsedURL.password = '';
        parsedURL.hash = '';
        const urls = [ parsedURL.href ];
        if ( parsedURL.search !== '' ) {
            parsedURL.search = '';
            urls.push(parsedURL.href);
        }
        if ( parsedURL.pathname !== '/' ) {
            parsedURL.pathname = '';
            urls.push(parsedURL.href);
        }
        const shouldUpdate = url.searchParams.get('shouldUpdateLists');
        return {
            hostname: parsedURL.hostname.replace(/^(m|mobile|www)\./, ''),
            popupPanel: JSON.parse(url.searchParams.get('popupPanel') ?? 'null'),
            urls,
            shouldUpdateLists: shouldUpdate !== null ? JSON.parse(shouldUpdate) as string[] : null,
        };
    } catch {
    }
    return null;
}

export const FILTER_REPORT_URL = 'https://github.com/uBlockOrigin/uAssets/issues/new?template=report_from_ubo.yml';
export const BUG_REPORT_URL = 'https://github.com/uBlockOrigin/uBlock-issues/issues/new?template=bug_report_from_ubo.yml';

export interface SupportState {
    text: string;
    reported: ReportedPage | null;
    updating: boolean;
    updated: boolean;
    diagnosticsShown: boolean;
    filterReportURL: string;
    bugReportURL: string;
}

export interface SupportActions {
    showDiagnostics(): void;
    updateFilterLists(): void;
    reportSpecificIssue(url: string, type: string, nsfw: boolean): void;
    findSimilarReports(): void;
}

export function useSupport(): [ SupportState, SupportActions ] {
    const reported = useMemo(readReportedPage, []);
    const [ text, setText ] = useState('');
    const [ updating, setUpdating ] = useState(false);
    const [ updated, setUpdated ] = useState(false);
    const [ diagnosticsShown, setDiagnosticsShown ] = useState(reported === null);
    const textRef = useRef(text);
    textRef.current = text;

    const load = useCallback(async () => {
        const supportData = await send<Data>('dashboard', { what: 'getSupportData' });
        const shown = JSON.parse(JSON.stringify(supportData)) as Data;
        uselessKeys.forEach(prop => { removeKey(shown, prop); });
        sensitiveValues.forEach(prop => { redactValue(shown, prop); });
        sensitiveKeys.forEach(prop => { redactKeys(shown, prop); });
        for ( const prop in shown ) { patchEmptiness(shown, prop); }
        if ( reported !== null ) { shown.popupPanel = reported.popupPanel; }
        setText(renderData(shown));
    }, [ reported ]);

    useEffect(() => {
        load();
        return onBroadcast(msg => {
            if ( msg.what === 'assetsUpdated' ) {
                setUpdating(false);
                setUpdated(true);
                return;
            }
            if ( msg.what === 'staticFilteringDataChanged' ) { load(); }
        });
    }, [ load ]);

    // The report links carry the (collapsed) configuration, as upstream.
    const withConfig = (base: string): string => {
        const url = new URL(base);
        url.searchParams.set('configuration', configToMarkdown(text, true));
        return url.href;
    };

    const actions: SupportActions = {
        showDiagnostics() { setDiagnosticsShown(true); },
        updateFilterLists() {
            if ( reported === null || reported.shouldUpdateLists === null ) { return; }
            setUpdating(true);
            send('dashboard', { what: 'supportUpdateNow', assetKeys: reported.shouldUpdateLists });
        },
        reportSpecificIssue(url, type, nsfw) {
            if ( reported === null ) { return; }
            const githubURL = new URL('https://github.com/uBlockOrigin/uAssets/issues/new?template=specific_report_from_ubo.yml');
            let title = `${reported.hostname}: ${type}`;
            if ( nsfw ) { title = `[nsfw] ${title}`; }
            githubURL.searchParams.set('title', title);
            githubURL.searchParams.set('url_address_of_the_web_page', '`' + url + '`');
            githubURL.searchParams.set('category', type);
            githubURL.searchParams.set('configuration', configToMarkdown(textRef.current, true));
            gotoURL(githubURL.href);
        },
        findSimilarReports() {
            if ( reported === null ) { return; }
            const url = new URL('https://github.com/uBlockOrigin/uAssets/issues');
            url.searchParams.set('q', `is:issue sort:updated-desc "${reported.hostname}" in:title`);
            gotoURL(url.href);
        },
    };

    return [ {
        text, reported, updating, updated, diagnosticsShown,
        filterReportURL: withConfig(FILTER_REPORT_URL),
        bugReportURL: withConfig(BUG_REPORT_URL),
    }, actions ];
}

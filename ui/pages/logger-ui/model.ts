// uBlockVanced - pure logger logic, ported from src/js/logger-ui.js.
//
// Nothing here touches the DOM or vAPI: entry parsing, the row filterer, the
// export formatter and the column-width maths are the same algorithms the
// upstream engine uses, so a row renders and filters identically.

/******************************************************************************/

export const COLUMN_TIMESTAMP = 0;
export const COLUMN_FILTER = 1;
export const COLUMN_MESSAGE = 1;
export const COLUMN_RESULT = 2;
export const COLUMN_INITIATOR = 3;
export const COLUMN_PARTYNESS = 4;
export const COLUMN_METHOD = 5;
export const COLUMN_TYPE = 6;
export const COLUMN_URL = 7;

export const DEFAULT_COLUMN_WIDTHS: readonly number[] = [ 0.25, 0.25, 0.5 ];

// Same clamping as upstream: neither flexible column may eat the URL column.
export function normalizeColumnWidths(widths: unknown): number[] {
    const values = Array.isArray(widths) ? widths : DEFAULT_COLUMN_WIDTHS;
    let filter = Number(values[0]);
    let initiator = Number(values[1]);
    if ( Number.isFinite(filter) === false ) { filter = DEFAULT_COLUMN_WIDTHS[0]; }
    if ( Number.isFinite(initiator) === false ) { initiator = DEFAULT_COLUMN_WIDTHS[1]; }
    filter = Math.max(0.1, Math.min(0.7, filter));
    initiator = Math.max(0.1, Math.min(0.7, initiator));
    if ( filter + initiator > 0.9 ) {
        const scale = 0.9 / (filter + initiator);
        filter *= scale;
        initiator *= scale;
    }
    return [ filter, initiator, 1 - filter - initiator ];
}

/******************************************************************************/

export const prettyRequestTypes: Record<string, string> = {
    'main_frame': 'doc',
    'stylesheet': 'css',
    'sub_frame': 'frame',
    'xmlhttprequest': 'xhr',
};

export const uglyRequestTypes: Record<string, string> = {
    'doc': 'main_frame',
    'css': 'stylesheet',
    'frame': 'sub_frame',
    'xhr': 'xmlhttprequest',
};

export const staticFilterTypes: Record<string, string> = {
    'beacon': 'ping',
    'doc': 'document',
    'css': 'stylesheet',
    'frame': 'subdocument',
    'object_subrequest': 'object',
    'csp_report': 'other',
};

export const reIsExceptionFilter = /^@@|^[\w.-]*?#@#/;
export const reSchemeOnly = /^[\w-]+:$/;

export const escapeRegexStr = (s: string): string =>
    s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/******************************************************************************/

export interface LoggerFilter {
    raw: string;
    result?: number;
    source?: string;
    modifier?: boolean;
    regex?: string;
    rule?: string[];
}

export interface LogEntryDetails {
    aliasURL?: string;
    docDomain?: string;
    docHostname?: string;
    domain?: string;
    filter?: LoggerFilter;
    hostname?: string;
    keywords?: string[];
    method?: string;
    realm?: string;
    tabDomain?: string;
    tabHostname?: string;
    tabId?: number;
    text?: string;
    tstamp: number;
    type?: string;
    url?: string;
    voided?: boolean;
}

let idGenerator = 1;

// The row model. `textContent` is the \x1F-joined cell text the row filterer
// matches against; every renderer field below mirrors an upstream attribute.
export class LogEntry {
    aliased = false;
    dead = false;
    docDomain = '';
    docHostname = '';
    domain = '';
    filter: LoggerFilter | undefined = undefined;
    id: number;
    method = '';
    realm = '';
    tabDomain = '';
    tabHostname = '';
    tabId: number | undefined = undefined;
    textContent = '';
    tstamp = 0;
    type = '';
    voided = false;

    constructor(details?: LogEntryDetails | LogEntry) {
        this.id = idGenerator++;
        if ( details instanceof Object === false ) { return; }
        const src = details as unknown as Record<string, unknown>;
        if ( typeof src.aliased === 'boolean' ) { this.aliased = src.aliased; }
        if ( typeof src.dead === 'boolean' ) { this.dead = src.dead; }
        if ( typeof src.docDomain === 'string' ) { this.docDomain = src.docDomain; }
        if ( typeof src.docHostname === 'string' ) { this.docHostname = src.docHostname; }
        if ( typeof src.domain === 'string' ) { this.domain = src.domain; }
        if ( src.filter instanceof Object ) { this.filter = src.filter as LoggerFilter; }
        if ( typeof src.method === 'string' ) { this.method = src.method; }
        if ( typeof src.realm === 'string' ) { this.realm = src.realm; }
        if ( typeof src.tabDomain === 'string' ) { this.tabDomain = src.tabDomain; }
        if ( typeof src.tabHostname === 'string' ) { this.tabHostname = src.tabHostname; }
        if ( typeof src.tabId === 'number' ) { this.tabId = src.tabId; }
        if ( typeof src.textContent === 'string' ) { this.textContent = src.textContent; }
        if ( typeof src.tstamp === 'number' ) { this.tstamp = src.tstamp; }
        if ( typeof src.type === 'string' ) { this.type = src.type; }
        if ( typeof src.voided === 'boolean' ) { this.voided = src.voided; }
        if ( src.aliasURL !== undefined ) { this.aliased = true; }
        if ( this.tabDomain === '' ) { this.tabDomain = this.tabHostname || ''; }
        if ( this.docDomain === '' ) { this.docDomain = this.docHostname || ''; }
        if ( this.domain === '' && typeof src.hostname === 'string' ) {
            this.domain = src.hostname;
        }
    }
}

/******************************************************************************/

const logDate = new Date();
const logDateTimezoneOffset = logDate.getTimezoneOffset() * 60;

const padTo2 = (v: number): string => v < 10 ? '0' + v : `${v}`;

const normalizeToStr = (s: unknown): string =>
    typeof s === 'string' && s !== '' ? s : '';

const hhmmss = (tstamp: number): string => {
    logDate.setTime((tstamp - logDateTimezoneOffset) * 1000);
    return padTo2(logDate.getUTCHours()) + ':' +
        padTo2(logDate.getUTCMinutes()) + ':' +
        padTo2(logDate.getSeconds());
};

export function createLogSeparator(details: LogEntry, text: string): LogEntry {
    const separator = new LogEntry();
    separator.tstamp = details.tstamp;
    separator.realm = 'message';
    separator.tabId = details.tabId;
    separator.type = 'tabLoad';
    separator.textContent = [ hhmmss(separator.tstamp), text ].join('\x1F');
    if ( details.voided ) { separator.voided = true; }
    return separator;
}

export function parseLogEntry(details: LogEntryDetails): LogEntry {
    // Patch realm until changed all over codebase to make this unnecessary
    if ( details.realm === 'cosmetic' ) { details.realm = 'extended'; }

    const entry = new LogEntry(details);
    const textContent: string[] = [];

    // Cell 0
    textContent.push(hhmmss(details.tstamp));

    // Cell 1 -- messages carry no further cells
    if ( details.realm === 'message' ) {
        textContent.push(details.text ?? '');
        if ( details.type ) { textContent.push(details.type); }
        if ( details.keywords ) { textContent.push(...details.keywords); }
        entry.textContent = textContent.join('\x1F') + '\x1F';
        return entry;
    }

    // Cell 1, 2
    if ( entry.filter !== undefined ) {
        textContent.push(entry.filter.raw);
        if ( entry.filter.result === 1 ) {
            textContent.push('--');
        } else if ( entry.filter.result === 2 ) {
            textContent.push('++');
        } else if ( entry.filter.result === 3 ) {
            textContent.push('**');
        } else if ( entry.filter.source === 'redirect' ) {
            textContent.push('<<');
        } else {
            textContent.push('');
        }
    } else {
        textContent.push('', '');
    }

    // Cell 3
    textContent.push(normalizeToStr(entry.docHostname));

    // Cell 4: partyness
    if ( entry.realm === 'network' && entry.domain !== '' ) {
        let partyness = '';
        if ( entry.tabDomain !== undefined ) {
            if ( (entry.tabId ?? 0) < 0 ) { partyness += '0,'; }
            partyness += entry.domain === entry.tabDomain ? '1' : '3';
        } else {
            partyness += '?';
        }
        if ( entry.docDomain !== entry.tabDomain ) {
            partyness += ',';
            if ( entry.docDomain !== undefined ) {
                partyness += entry.domain === entry.docDomain ? '1' : '3';
            } else {
                partyness += '?';
            }
        }
        textContent.push(partyness);
    } else {
        textContent.push('');
    }

    // Cell 5: method
    textContent.push(entry.method || '');

    // Cell 6
    textContent.push(normalizeToStr(prettyRequestTypes[entry.type] || entry.type));

    // Cell 7
    textContent.push(normalizeToStr(details.url));

    // Cell 8 -- hidden, used for row filtering only
    if ( entry.aliased ) {
        textContent.push(`aliasURL=${details.aliasURL}`);
    }

    entry.textContent = textContent.join('\x1F');
    return entry;
}

export function aliasURLFromEntry(entry: LogEntry): string {
    const match = /\baliasURL=([^\x1F]+)/.exec(entry.textContent);
    return match === null ? '' : match[1];
}

/******************************************************************************/

// Everything upstream's renderToDiv() derives from a row, in one object: the
// renderer and the entry dialog both read it, so a row and its details can
// never disagree.
export interface EntryView {
    entry: LogEntry;
    cells: string[];
    realmClass: string;
    isMessage: boolean;
    isNetwork: boolean;
    isExtended: boolean;
    canDetails: boolean;
    canLookup: boolean;
    isException: boolean;
    isScriptlet: boolean;
    isRedirect: boolean;
    /** '' | '1' (block) | '2' (allow) | '3' (noop) */
    status: string;
    modifier: boolean;
    filterText: string;
    filteringType: string;
    parties: string;
    tabHostname: string;
    docHostname: string;
    type: string;
    url: string;
    aliasURL: string;
    /** Filter sources whose "Rule" row the details pane shows. */
    isRule: boolean;
}

const detailableRealms = new Set([ 'network', 'extended' ]);
const ruleSources = new Set([ 'dynamicHost', 'dynamicUrl', 'switch' ]);
const reCosmeticPrefix = /^#@?#/;

export function entryView(entry: LogEntry): EntryView {
    const cells = entry.textContent.split('\x1F');
    const filter = entry.filter;
    const filteringType = typeof filter?.source === 'string' ? filter.source : '';
    const filterText = cells[COLUMN_FILTER] ?? '';
    const isExtended = entry.realm === 'extended';
    const isMessage = entry.realm === 'message';
    const result = cells[COLUMN_RESULT] ?? '';
    let canLookup = false;
    let isException = false;
    let isScriptlet = false;
    if ( filter !== undefined ) {
        if ( filteringType === 'static' ) {
            canLookup = true;
        } else if ( isExtended ) {
            canLookup = reCosmeticPrefix.test(filter.raw);
            isException = filter.raw.startsWith('#@#');
        }
    }
    const match = reCosmeticPrefix.exec(filterText);
    if ( match !== null ) {
        isScriptlet = /^\+js\(.*\)$/.test(filterText.slice(match[0].length));
    }
    let parties = '';
    if ( (cells[COLUMN_PARTYNESS] ?? '') !== '' && entry.realm === 'network' ) {
        parties = `${entry.tabDomain}`;
        if ( entry.docDomain !== entry.tabDomain ) { parties += ` ⋯ ${entry.docDomain}`; }
        parties += ` ⇒ ${entry.domain}`;
    }
    let status = '';
    if ( result === '--' ) {
        status = '1';
    } else if ( result === '++' ) {
        status = '2';
    } else if ( result === '**' ) {
        status = '3';
    }
    return {
        entry,
        cells,
        realmClass: entry.realm !== '' ? `${entry.realm}Realm` : '',
        isMessage,
        isNetwork: entry.realm === 'network',
        isExtended,
        canDetails: detailableRealms.has(entry.realm),
        canLookup,
        isException,
        isScriptlet,
        isRedirect: result === '<<',
        status,
        modifier: filter?.modifier === true,
        filterText,
        filteringType,
        parties,
        tabHostname: entry.tabHostname,
        docHostname: entry.docHostname,
        type: cells[COLUMN_TYPE] ?? '',
        url: cells[COLUMN_URL] ?? '',
        aliasURL: entry.aliased ? aliasURLFromEntry(entry) : '',
        isRule: ruleSources.has(filteringType),
    };
}

// The href upstream's nodeFromURL() gives a URL cell: viewable resources go
// through the code viewer, everything else opens as-is.
export function hrefForURL(url: string, type: string): string | undefined {
    if ( /^https?:\/\//.test(url) === false ) { return undefined; }
    switch ( type ) {
    case 'css':
    case 'doc':
    case 'frame':
    case 'object':
    case 'other':
    case 'script':
    case 'xhr':
        return `code-viewer.html?url=${encodeURIComponent(url)}`;
    default:
        return url;
    }
}

/******************************************************************************/

// Row filtering ------------------------------------------------------------

export interface RowFilter { re: RegExp; r: boolean }

export interface FiltexItem {
    /** The regex source the upstream picker carries in data-filtex. */
    filtex: string;
    /** Literal label, used when `i18nKey` is absent. */
    label?: string;
    i18nKey?: string;
    /** Selected on a fresh profile (upstream `class="on"`). */
    on?: boolean;
}

export interface FiltexGroup {
    id: string;
    i18nKey: string;
    /** The leading "Not" token of the upstream row. */
    notOn?: boolean;
    /** Shown only once a CNAME-aliased row has been seen. */
    cnameOnly?: boolean;
    items: FiltexItem[];
}

// One-for-one with the <div> rows of #filterExprPicker in src/logger-ui.html.
export const FILTEX_GROUPS: readonly FiltexGroup[] = [
    {
        id: 'result',
        i18nKey: 'loggerUiFilterGroupResult',
        items: [
            { filtex: '\\x1F--\\x1F|\\x1F<<\\x1F|\\x1F##', i18nKey: 'loggerRowFiltererBuiltinBlocked' },
            { filtex: '\\x1F\\+\\+\\x1F|\\x1F\\*\\*\\x1F|\\x1F#@#', i18nKey: 'loggerRowFiltererBuiltinAllowed' },
            { filtex: '[$,](?:csp|permissions|removeparam|redirect-rule|replace|urlskip|ur[il]transform)=|\\x1F\\<\\<\\x1F', i18nKey: 'loggerRowFiltererBuiltinModified' },
        ],
    },
    {
        id: 'type',
        i18nKey: 'loggerUiFilterGroupType',
        items: [
            { filtex: '\\x1F(?:css|(?:inline-)?font)\\x1F', label: 'css/font' },
            { filtex: '\\x1Fimage\\x1F', label: 'image' },
            { filtex: '\\x1Fmedia\\x1F', label: 'media' },
            { filtex: '\\x1F(?:inline-)?script(?:ing)?\\x1F', label: 'script' },
            { filtex: '\\x1F(?:websocket|xhr)\\x1F', label: 'xhr' },
            { filtex: '\\x1F(?:frame|object)\\x1F', label: 'frame' },
            { filtex: '\\x1F(?:dom|g(?:eneric)?hide|s(?:pecific)?hide)\\x1F', label: 'dom' },
            { filtex: '\\x1F(?:scriptlet)\\x1F', label: 'scriptlet' },
            { filtex: '\\x1F(?:beacon|csp_report|doc|ping|popup|popunder|other)\\x1F', label: 'other' },
        ],
    },
    {
        id: 'party',
        i18nKey: 'loggerUiFilterGroupParty',
        items: [
            { filtex: '\\x1F(?:0,)?1\\x1F', i18nKey: 'loggerRowFiltererBuiltin1p' },
            { filtex: '\\x1F(?:3(?:,\\d)?|0,3)\\x1F', i18nKey: 'loggerRowFiltererBuiltin3p' },
            { filtex: '\\x1F0,\\d\\x1F', label: 'tabless' },
        ],
    },
    {
        id: 'method',
        i18nKey: 'loggerUiFilterGroupMethod',
        items: [
            { filtex: '\\x1Fget\\x1F', label: 'get' },
            { filtex: '\\x1Fhead\\x1F', label: 'head' },
            { filtex: '\\x1Fpost\\x1F', label: 'post' },
        ],
    },
    {
        id: 'modifier',
        i18nKey: 'loggerUiFilterGroupModifier',
        notOn: true,
        items: [
            { filtex: '\\bcsp=[^\\x1F]+\\x1F(?:--|\\+\\+)\\x1F', label: 'csp' },
            { filtex: '\\bpermissions=[^\\x1F]+\\x1F(?:--|\\+\\+)\\x1F', label: 'permissions', on: true },
            { filtex: '\\bredirect-rule=[^\\x1F]+\\x1F(?:--|\\+\\+)\\x1F', label: 'redirect' },
            { filtex: '\\bremoveparam=[^\\x1F]+\\x1F(?:--|\\+\\+)\\x1F', label: 'removeparam' },
            { filtex: '\\breplace=[^\\x1F]+\\x1F(?:--|\\+\\+)\\x1F', label: 'replace' },
            { filtex: '\\burlskip=[^\\x1F]+\\x1F(?:--|\\+\\+)\\x1F', label: 'urlskip' },
        ],
    },
    {
        id: 'cname',
        i18nKey: 'loggerUiFilterGroupCname',
        cnameOnly: true,
        items: [
            { filtex: '\\x1FaliasURL=.', label: 'CNAME' },
        ],
    },
    {
        id: 'severity',
        i18nKey: 'loggerUiFilterGroupSeverity',
        items: [
            { filtex: '\\x1Finfo\\x1F', label: 'info' },
            { filtex: '\\x1Ferror\\x1F', label: 'error' },
        ],
    },
];

export interface FiltexState {
    /** data-filtex sources currently toggled on. */
    on: Set<string>;
    /** Group ids whose leading "Not" token is toggled on. */
    not: Set<string>;
}

export function defaultFiltexState(): FiltexState {
    const on = new Set<string>();
    const not = new Set<string>();
    for ( const group of FILTEX_GROUPS ) {
        if ( group.notOn ) { not.add(group.id); }
        for ( const item of group.items ) {
            if ( item.on ) { on.add(item.filtex); }
        }
    }
    return { on, not };
}

// Same OR-per-row / NOT-per-row semantics as upstream's
// builtinFilterExpression(): each picker row is one regex, negated when that
// row's "Not" token is active.
export function builtinFilters(state: FiltexState): RowFilter[] {
    const out: RowFilter[] = [];
    for ( const group of FILTEX_GROUPS ) {
        const orExprs = group.items
            .filter(item => state.on.has(item.filtex))
            .map(item => item.filtex);
        if ( orExprs.length === 0 ) { continue; }
        out.push({
            re: new RegExp(orExprs.join('|')),
            r: state.not.has(group.id) === false,
        });
    }
    return out;
}

// Verbatim port of rowFilterer.parseInput().
export function userFilters(input: string): RowFilter[] {
    const out: RowFilter[] = [];
    const rawParts = input.trim().split(/\s+/);
    const n = rawParts.length;
    const reStrs: string[] = [];
    let not = false;
    for ( let i = 0; i < n; i++ ) {
        let rawPart = rawParts[i];
        if ( rawPart.charAt(0) === '!' ) {
            if ( reStrs.length === 0 ) { not = true; }
            rawPart = rawPart.slice(1);
        }
        let reStr = '';
        if ( rawPart.startsWith('/') && rawPart.endsWith('/') ) {
            reStr = rawPart.slice(1, -1);
            try {
                void new RegExp(reStr);
            } catch {
                reStr = '';
            }
        }
        if ( reStr === '' ) {
            const hardBeg = rawPart.startsWith('|');
            if ( hardBeg ) { rawPart = rawPart.slice(1); }
            const hardEnd = rawPart.endsWith('|');
            if ( hardEnd ) { rawPart = rawPart.slice(0, -1); }
            reStr = escapeRegexStr(rawPart);
            if ( hardBeg ) { reStr = reStr !== '' ? '(?:^|\\s|\\|)' + reStr : '\\|'; }
            if ( hardEnd ) { reStr += '(?:\\||\\s|$)'; }
        }
        if ( reStr === '' ) { continue; }
        reStrs.push(reStr);
        if ( i < (n - 1) && rawParts[i + 1] === '||' ) {
            i += 1;
            continue;
        }
        reStr = reStrs.length === 1 ? reStrs[0] : reStrs.join('|');
        out.push({ re: new RegExp(reStr, 'i'), r: !not });
        reStrs.length = 0;
        not = false;
    }
    return out;
}

export function filterOne(
    logEntry: LogEntry,
    selectedTabId: number,
    masterSwitch: boolean,
    filters: readonly RowFilter[],
): boolean {
    if ( logEntry.dead ) { return false; }
    if ( selectedTabId !== 0 ) {
        if ( logEntry.tabId !== undefined && logEntry.tabId > 0 ) {
            if ( logEntry.tabId !== selectedTabId ) { return false; }
        }
    }
    if ( masterSwitch === false || filters.length === 0 ) { return true; }
    // Tab-load separators always survive: they key the sections of the log.
    if ( logEntry.type === 'tabLoad' ) { return true; }
    for ( const f of filters ) {
        if ( f.re.test(logEntry.textContent) !== f.r ) { return false; }
    }
    return true;
}

/******************************************************************************/

// Entry-details helpers ----------------------------------------------------

const reRFC3986 = /^([^:/?#]+:)?(\/\/[^/?#]*)?([^?#]*)(\?[^#]*)?(#.*)?/;

export function shortenLongString(url: string, max: number): string {
    const urlLen = url.length;
    if ( urlLen <= max ) { return url; }
    const n = urlLen - max - 1;
    const i = (urlLen - n) / 2 | 0;
    return url.slice(0, i) + '…' + url.slice(i + n);
}

// Candidate URLs for a dynamic URL-filtering rule, longest first.
export function createTargetURLs(url: string): string[] {
    const matches = reRFC3986.exec(url);
    if ( matches === null ) { return []; }
    if ( typeof matches[2] !== 'string' || matches[2].length === 0 ) {
        return matches[1] ? [ matches[1] ] : [];
    }
    const urls: string[] = [];
    const rootURL = matches[1] + matches[2];
    urls.unshift(rootURL);
    const path = matches[3] || '';
    let pos = path.charAt(0) === '/' ? 1 : 0;
    while ( pos < path.length ) {
        pos = path.indexOf('/', pos);
        if ( pos === -1 ) {
            pos = path.length;
        } else {
            pos += 1;
        }
        urls.unshift(rootURL + path.slice(0, pos));
    }
    const query = matches[4] || '';
    if ( query !== '' ) {
        urls.unshift(rootURL + path + query);
    }
    return urls;
}

export function toExceptionFilter(filter: string, extended: boolean): string {
    if ( reIsExceptionFilter.test(filter) ) { return filter; }
    return extended ? filter.replace('##', '#@#') : `@@${filter}`;
}

export function regexFromURLFilteringResult(result: string): RegExp {
    const beg = result.indexOf(' ');
    const end = result.indexOf(' ', beg + 1);
    const url = result.slice(beg + 1, end);
    if ( url === '*' ) { return new RegExp('^.*$', 'gi'); }
    return new RegExp('^' + escapeRegexStr(url), 'gi');
}

// The origin ladder upstream fills its context <select> with.
export function originCandidates(hostname: string, domain: string): string[] {
    const out: string[] = [];
    let value = hostname;
    for (;;) {
        out.push(value);
        if ( value === domain ) { break; }
        const pos = value.indexOf('.');
        if ( pos === -1 ) { break; }
        value = value.slice(pos + 1);
    }
    return out;
}

export function hostnameFromURI(uri: string): string {
    try {
        return new URL(uri).hostname;
    } catch {
        return '';
    }
}

/******************************************************************************/

// Export formatter ---------------------------------------------------------

export type ExportFormat = 'list' | 'table';
export type ExportEncoding = 'plain' | 'markdown';

export interface ExportOptions {
    format: ExportFormat;
    encoding: ExportEncoding;
    time: 'anonymous' | 'local';
}

function collectLines(entries: readonly LogEntry[], options: ExportOptions): string[][] {
    const lines: string[][] = [];
    const t0 = entries.length !== 0 ? entries[entries.length - 1].tstamp : 0;
    for ( const entry of entries ) {
        const text = entry.textContent;
        const fields: string[] = [];
        let beg = text.indexOf('\x1F');
        if ( beg === 0 ) { continue; }
        let timeField = text.slice(0, beg);
        if ( options.time === 'anonymous' ) {
            timeField = '+' + Math.round(entry.tstamp - t0).toString();
        }
        fields.push(timeField);
        beg += 1;
        while ( beg < text.length ) {
            let end = text.indexOf('\x1F', beg);
            if ( end === -1 ) { end = text.length; }
            fields.push(text.slice(beg, end));
            beg = end + 1;
        }
        lines.push(fields);
    }
    return lines;
}

function formatAsPlainTextTable(lines: string[][]): string {
    const outputAll: string[] = [];
    for ( const fields of lines ) {
        outputAll.push(fields.join('\t'));
    }
    outputAll.push('');
    return outputAll.join('\n');
}

function formatAsMarkdownTable(lines: string[][]): string {
    const outputAll: string[] = [];
    let fieldCount = 0;
    for ( const fields of lines ) {
        if ( fields.length <= 2 ) { continue; }
        if ( fields.length > fieldCount ) { fieldCount = fields.length; }
        const outputOne: string[] = [];
        for ( let i = 0; i < fields.length; i++ ) {
            const field = fields[i];
            const code = i === 1 || /\b(?:www\.|https?:\/\/)/.test(field) ? '`' : '';
            outputOne.push(` ${code}${field.replace(/\|/g, '\\|')}${code} `);
        }
        outputAll.push(outputOne.join('|'));
    }
    if ( fieldCount !== 0 ) {
        outputAll.unshift(
            `${' |'.repeat(fieldCount - 1)} `,
            `${':--- |'.repeat(fieldCount - 1)}:--- `,
        );
    }
    return `<details><summary>Logger output</summary>\n\n|${outputAll.join('|\n|')}|\n</details>\n`;
}

function formatAsList(lines: string[][], options: ExportOptions): string {
    const outputAll: string[] = [];
    for ( const fields of lines ) {
        const outputOne: string[] = [];
        for ( const str of fields ) {
            if ( str.length === 0 ) { continue; }
            outputOne.push(str);
        }
        outputAll.push(outputOne.join('\n'));
    }
    let before: string, between: string, after: string;
    if ( options.encoding === 'markdown' ) {
        const code = '```';
        before = `<details><summary>Logger output</summary>\n\n${code}\n`;
        between = `\n${code}\n${code}\n`;
        after = `\n${code}\n</details>\n`;
    } else {
        before = '';
        between = '\n\n';
        after = '\n';
    }
    return `${before}${outputAll.join(between)}${after}`;
}

export function formatExport(entries: readonly LogEntry[], options: ExportOptions): string {
    const lines = collectLines(entries, options);
    if ( options.format === 'list' ) { return formatAsList(lines, options); }
    return options.encoding === 'plain'
        ? formatAsPlainTextTable(lines)
        : formatAsMarkdownTable(lines);
}

/******************************************************************************/

// Persisted settings -------------------------------------------------------

export interface LoggerSettings {
    discard: {
        maxAge: number;         // global, minutes
        maxEntryCount: number;  // per-tab
        maxLoadCount: number;   // per-tab
    };
    columns: boolean[];
    columnWidths: number[] | null;
    linesPerEntry: number;
}

export const LOGGER_SETTINGS_KEY = 'loggerSettings';

export function defaultSettings(): LoggerSettings {
    return {
        discard: { maxAge: 240, maxEntryCount: 2000, maxLoadCount: 20 },
        columns: [ true, true, true, true, true, true, true, true, true ],
        columnWidths: null,
        linesPerEntry: 4,
    };
}

// Same tolerant merge upstream does when reading vAPI.localStorage.
export function mergeStoredSettings(raw: unknown): LoggerSettings {
    const settings = defaultSettings();
    if ( typeof raw !== 'string' ) { return settings; }
    try {
        const stored = JSON.parse(raw) as Partial<LoggerSettings>;
        if ( typeof stored.discard?.maxAge === 'number' ) {
            settings.discard.maxAge = stored.discard.maxAge;
        }
        if ( typeof stored.discard?.maxEntryCount === 'number' ) {
            settings.discard.maxEntryCount = stored.discard.maxEntryCount;
        }
        if ( typeof stored.discard?.maxLoadCount === 'number' ) {
            settings.discard.maxLoadCount = stored.discard.maxLoadCount;
        }
        if ( typeof stored.linesPerEntry === 'number' ) {
            settings.linesPerEntry = stored.linesPerEntry;
        }
        if ( Array.isArray(stored.columns) ) {
            settings.columns = stored.columns;
        }
        if ( Array.isArray(stored.columnWidths) ) {
            settings.columnWidths = normalizeColumnWidths(stored.columnWidths);
        }
    } catch {
    }
    return settings;
}

export function clampNumber(value: number, min: number, max: number, def: number): number {
    if ( Number.isFinite(value) === false ) { value = def; }
    return Math.max(min, Math.min(max, value));
}

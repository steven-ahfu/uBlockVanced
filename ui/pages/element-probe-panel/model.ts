/*******************************************************************************

    uBlockVanced - Element Probe: types and pure helpers.

    Everything the panel computes without touching the DOM, lifted out of the
    upstream src/js/element-probe/{state,ui,frames}.js so the React tree can
    render from plain data. The page-context scripts are not copied: they stay
    in src/js/element-probe/page-scripts.js and are imported as-is.

*/

import { t } from '../../shared/i18n';

/******************************************************************************/

export interface SelectorEntry {
    type: string;
    label: string;
    selector: string;
    matches: number;
}

export interface ProceduralEntry {
    type: string;
    label: string;
    filter: string;
    description: string;
}

export interface ElementRect { w: number; h: number }

export interface InspectedData {
    tag: string;
    id: string;
    classes: string[];
    attrs: Record<string, string>;
    rect: ElementRect | null;
    visibility: string;
    position: string;
    computed: string;
    inShadowDOM: boolean;
    shadowHost: string;
    shadowClosed: boolean;
    selectors: SelectorEntry[];
    proceduralFilters: ProceduralEntry[];
    textContent: string;
    parentText: string;
    pageUrl: string;
    hostname: string;
    error?: string;
}

export interface FrameEntry {
    src: string;
    id: string;
    name: string;
    dims: string;
    visible: boolean;
}

export interface HistoryEntry {
    filter: string;
    selector: string;
    hostname: string;
    timestamp: number;
    active: boolean;
}

export type LogTone = '' | 'info' | 'success' | 'error';

export interface LogEntry {
    id: number;
    text: string;
    tone: LogTone;
}

export type StatusTone = 'idle' | 'active' | 'error';

export type RuleType = '##' | '#@#' | '##-remove' | '##-style';

export type FilterMode = 'idle' | 'ready' | 'procedural' | 'preview';

export interface Collision {
    type: 'conflict' | 'duplicate' | 'subset' | 'superset';
    rule: string;
}

/******************************************************************************/

// Same expression as src/js/element-probe/ui.js.
export const PROCEDURAL_RE = /:has-text|:upward|:xpath\(|:matches-path|:matches-attr|:matches-css|:matches-media|:matches-prop|:min-text-length|:remove\(\)|:style\(|:watch-attr|:others\(\)|:not\(:has-text\(/i;

// Copied verbatim from src/js/element-probe/frames.js: this runs in the
// inspected page, so it stays plain ES5 source text.
export const FRAME_SCAN_SCRIPT = `
(function() {
    var frames = document.querySelectorAll('iframe');
    var results = [];
    for (var i = 0; i < frames.length; i++) {
        var f = frames[i];
        var src = '';
        try { src = f.src || f.contentWindow.location.href; } catch(e) { src = f.src || ''; }
        if (!src || src === 'about:blank') continue;
        results.push({ src: src, id: f.id || '', name: f.name || '', dims: f.offsetWidth + 'x' + f.offsetHeight, visible: f.offsetParent !== null || f.offsetWidth > 0 });
    }
    return JSON.stringify(results);
})()`;

// Counts what a plain CSS selector matches in the inspected page
// (src/js/element-probe/ui.js updateMatchCount).
export const matchCountScript = (selector: string): string =>
    `(function(){try{return document.querySelectorAll(${JSON.stringify(selector)}).length}catch(e){return -1}})()`;

// Undoes HIDE_ELEMENT_SCRIPT for one selector
// (src/js/element-probe/history.js unhideOnPage).
export const unhideScript = (selector: string): string =>
    `(function(){try{var e=document.querySelectorAll(${JSON.stringify(selector)});for(var i=0;i<e.length;i++){e[i].style.removeProperty('display');e[i].style.removeProperty('content-visibility');e[i].style.removeProperty('max-height');e[i].style.removeProperty('overflow')}return e.length}catch(e){return -1}})()`;

/******************************************************************************/

export function truncate(text: string, max = 88): string {
    if ( typeof text !== 'string' ) { return ''; }
    const normalized = text.replace(/\s+/g, ' ').trim();
    return normalized.length <= max
        ? normalized
        : normalized.slice(0, max - 1) + '…';
}

export function formatSelectionLabel(data: InspectedData | null): string {
    if ( data === null ) { return t('epOverviewSelectionDefault'); }
    const label: string[] = [];
    if ( data.tag ) { label.push(`<${data.tag}>`); }
    if ( data.id ) { label.push(`#${data.id}`); }
    if ( Array.isArray(data.classes) && data.classes.length !== 0 ) {
        label.push(`.${data.classes[0]}`);
    }
    return label.join(' ') || 'Selected element';
}

// The text of one <option> in the upstream frame <select>.
export function frameLabel(frame: FrameEntry): string {
    let label = '';
    try {
        const url = new URL(frame.src);
        label = url.pathname.replace(/^\//, '').substring(0, 50) || url.hostname;
    } catch { label = frame.src.substring(0, 60); }
    if ( frame.id ) { label = '#' + frame.id + ' - ' + label; }
    else if ( frame.name ) { label = frame.name + ' - ' + label; }
    return label + ' [' + frame.dims + ']';
}

export function pluralLabel(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function matchesLabel(matches: number): string {
    return matches === -1 ? '?' : `${matches} match${matches === 1 ? '' : 'es'}`;
}

/******************************************************************************/

export interface FilterInputs {
    domains: string;
    hostname: string;
    ruleType: RuleType;
    styleValue: string;
}

// src/js/element-probe/ui.js generateFilter(), reading the fields as values.
export function generateFilter(sel: SelectorEntry, inputs: FilterInputs): string {
    const hostname = inputs.domains.trim() || inputs.hostname || '*';
    const type = inputs.ruleType || '##';
    if ( type === '##-remove' ) { return hostname + '##' + sel.selector + ':remove()'; }
    if ( type === '##-style' ) {
        const style = inputs.styleValue.trim() || 'opacity: 0 !important';
        return hostname + '##' + sel.selector + ':style(' + style + ')';
    }
    return hostname + type + sel.selector;
}

/******************************************************************************/

export interface OverviewCopy { value: string; hint: string }

export interface Overview {
    target: OverviewCopy;
    selection: OverviewCopy;
    output: OverviewCopy;
}

export interface OverviewInputs {
    data: InspectedData | null;
    filterText: string;
    frameCount: number;
    frameName: string;
    frameUrl: string;
    isHighlighting: boolean;
    selectorCount: number;
}

// src/js/element-probe/ui.js updateWorkflowSummary(), as a pure function.
export function overviewOf(inputs: OverviewInputs): Overview {
    const output = inputs.filterText;
    const hasFilterValue = output.trim() !== '';
    const isProcedural = PROCEDURAL_RE.test(output);
    const target: OverviewCopy = {
        value: inputs.frameUrl ? 'Focused iframe' : t('epOverviewTargetDefault'),
        hint: inputs.frameUrl
            ? truncate(inputs.frameName, 84)
            : inputs.frameCount === 0
                ? t('epOverviewTargetHint')
                : `${inputs.frameCount} iframe target${inputs.frameCount === 1 ? '' : 's'} detected on this page.`,
    };
    const data = inputs.data;
    const selection: OverviewCopy = data !== null
        ? {
            value: formatSelectionLabel(data),
            hint: data.inShadowDOM
                ? `Inside shadow DOM${data.shadowHost ? ` via ${data.shadowHost}` : ''}.`
                : truncate(data.textContent || `On ${data.hostname || 'the current page'}`, 84),
        }
        : {
            value: t('epOverviewSelectionDefault'),
            hint: t('epOverviewSelectionHint'),
        };
    if ( data === null ) {
        return {
            target,
            selection,
            output: { value: t('epOverviewOutputDefault'), hint: t('epOverviewOutputHint') },
        };
    }
    const proceduralCount = Array.isArray(data.proceduralFilters)
        ? data.proceduralFilters.length
        : 0;
    if ( hasFilterValue ) {
        return {
            target,
            selection,
            output: {
                value: isProcedural
                    ? 'Procedural rule ready'
                    : inputs.isHighlighting ? 'Previewing rule' : 'Rule ready',
                hint: isProcedural
                    ? 'Save it to your filters, then reload the page to validate the result.'
                    : inputs.isHighlighting
                        ? 'A live highlight is active on the inspected page for the current selector.'
                        : 'Preview, copy, or save the current selector as a cosmetic filter.',
            },
        };
    }
    return {
        target,
        selection,
        output: {
            value: `${inputs.selectorCount} selector${inputs.selectorCount === 1 ? '' : 's'} ready`,
            hint: proceduralCount === 0
                ? 'Pick the most stable selector to continue.'
                : `${proceduralCount} procedural filter${proceduralCount === 1 ? '' : 's'} also generated for harder targets.`,
        },
    };
}

/******************************************************************************/

export interface FilterHint { badge: string; text: string; mode: FilterMode }

export interface HintInputs {
    data: InspectedData | null;
    filterText: string;
    isHighlighting: boolean;
    selectorCount: number;
}

// src/js/element-probe/ui.js updateFilterHint(), as a pure function.
export function filterHintOf(inputs: HintInputs): FilterHint {
    const value = inputs.filterText.trim();
    const hasValue = value !== '';
    if ( inputs.data !== null && hasValue === false ) {
        return {
            badge: 'Choose a selector',
            text: inputs.selectorCount === 0
                ? 'No stable selectors were generated for this node yet. Try scanning shadow DOM or picking a different ancestor.'
                : `${inputs.selectorCount} selector suggestion${inputs.selectorCount === 1 ? '' : 's'} ready. Pick the most stable option before saving.`,
            mode: 'ready',
        };
    }
    if ( hasValue && PROCEDURAL_RE.test(value) ) {
        return {
            badge: 'Procedural rule',
            text: 'Procedural rule — click Preview to highlight matching elements, or Apply to save to your filters.',
            mode: 'procedural',
        };
    }
    if ( hasValue && inputs.isHighlighting ) {
        return {
            badge: 'Preview active',
            text: 'The current selector is highlighted in the inspected page. Save it if the match looks right, or clear the preview.',
            mode: 'preview',
        };
    }
    if ( hasValue ) {
        return {
            badge: 'Rule ready',
            text: 'CSS selectors can be previewed before saving, copied for review, or sent straight to your user filters.',
            mode: 'ready',
        };
    }
    return { badge: t('epHintBadgeDefault'), text: t('epHintTextDefault'), mode: 'idle' };
}

/******************************************************************************/

export interface CompatBadge { label: string; level: 'narrow' | 'wide'; title: string }

const UBO_ONLY = [ ':matches-path', ':matches-media', ':watch-attr', ':others()' ];
const SHARED = [ ':has-text', ':upward', ':matches-attr', ':matches-css', ':remove()', ':min-text-length', ':not(:has-text' ];

// src/js/element-probe/ui.js updateCompatBadge(), as a pure function.
export function compatBadgeOf(value: string): CompatBadge {
    const found: string[] = [];
    for ( const op of UBO_ONLY ) { if ( value.includes(op) ) { found.push(`${op} → uBO only`); } }
    for ( const op of SHARED ) { if ( value.includes(op) ) { found.push(`${op} → uBO, AdGuard, Brave`); } }
    const narrow = found.some(text => text.endsWith('uBO only'));
    return {
        label: narrow ? 'uBO only' : found.length ? 'uBO+AG+Brave' : '',
        level: narrow ? 'narrow' : 'wide',
        title: found.join('\n'),
    };
}

// The match-count badge, from the count the inspected page reported.
export function matchCountLabel(count: number | null): { state: string; text: string } {
    if ( count === null ) { return { state: '', text: 'procedural' }; }
    if ( count === -1 ) { return { state: 'error', text: 'invalid' }; }
    if ( count === 0 ) { return { state: 'zero', text: '0 matches' }; }
    return { state: 'match', text: count + ' match' + (count === 1 ? '' : 'es') };
}

/******************************************************************************/

// src/js/element-probe/history.js checkFilterCollision(), minus the messaging:
// the user-rules text in, the collisions out.
export function collisionsOf(content: string, newFilter: string): Collision[] | null {
    const rules = content.split('\n').filter(line => line.trim() && !line.startsWith('!'));
    const next = newFilter.match(/^(.+?)(##|#@#)(.+)$/);
    if ( next === null ) { return null; }
    const collisions: Collision[] = [];
    for ( const rule of rules ) {
        const current = rule.match(/^(.+?)(##|#@#)(.+)$/);
        if ( current === null ) { continue; }
        if ( rule === newFilter ) { collisions.push({ type: 'duplicate', rule }); continue; }
        if (
            current[1] === next[1] &&
            current[2] !== next[2] &&
            current[3] === next[3]
        ) {
            collisions.push({ type: 'conflict', rule });
            continue;
        }
        if ( current[3] !== next[3] || current[2] !== next[2] ) { continue; }
        if ( current[1] === '*' || current[1] === next[1] ) { collisions.push({ type: 'superset', rule }); }
        else if ( next[1] === '*' ) { collisions.push({ type: 'subset', rule }); }
    }
    return collisions.length ? collisions : null;
}

/******************************************************************************/

export interface HelpRow { description: string; operator: string; usage: string }

// The upstream syntax-reference table, row for row.
export const HELP_ROWS: HelpRow[] = [
    { description: 'Hide elements matching CSS selector', operator: '##', usage: 'example.com##div.ad' },
    { description: 'Exception — unblock a hiding rule', operator: '#@#', usage: 'example.com#@#div.ad' },
    { description: 'Match by text content (literal or /regex/)', operator: ':has-text()', usage: 'div:has-text(Subscribe)' },
    { description: 'Walk up N ancestors, or :upward(.card) to find by selector', operator: ':upward()', usage: 'span:upward(2)' },
    { description: 'Only apply on specific URL paths', operator: ':matches-path()', usage: 'div:matches-path(/video/)' },
    { description: 'Match by attribute name or name=value', operator: ':matches-attr()', usage: 'div:matches-attr("data-ad")' },
    { description: 'Match by computed CSS property value', operator: ':matches-css()', usage: 'div:matches-css(position: fixed)' },
    { description: 'Only match if text is at least N chars', operator: ':min-text-length()', usage: 'p:min-text-length(20)' },
    { description: 'Remove from DOM instead of hiding', operator: ':remove()', usage: 'div.banner:remove()' },
    { description: 'XPath expression selector', operator: ':xpath()', usage: ':xpath(//div[@class])' },
    { description: 'Re-evaluate when attributes change (SPAs)', operator: ':watch-attr()', usage: 'div:watch-attr(data-state)' },
    { description: 'Hide everything EXCEPT matched elements', operator: ':others()', usage: 'div.main:others()' },
    { description: 'Negate any procedural operator', operator: ':not()', usage: 'div:not(:has-text(Keep))' },
];

// The rule-type <select> options, in the upstream order.
export const RULE_TYPES: Array<{ key: string; value: RuleType }> = [
    { key: 'epRuleBlock', value: '##' },
    { key: 'epRuleException', value: '#@#' },
    { key: 'epRuleRemove', value: '##-remove' },
    { key: 'epRuleStyle', value: '##-style' },
];

// The element-details rows, in the upstream order.
export function elementRows(data: InspectedData): Array<{ key: string; kind: string; value: string }> {
    const attrKeys = Object.keys(data.attrs);
    return [
        { key: 'epLabelTag', kind: 'tag', value: '<' + (data.tag || '?') + '>' },
        { key: 'epLabelId', kind: 'id', value: data.id || '(none)' },
        { key: 'epLabelClasses', kind: 'classes', value: data.classes.length ? data.classes.join(' ') : '(none)' },
        { key: 'epLabelAttrs', kind: 'attrs', value: attrKeys.length ? attrKeys.map(k => `${k}="${data.attrs[k]}"`).join(', ') : '(none)' },
        { key: 'epLabelText', kind: 'text', value: data.textContent ? data.textContent.substring(0, 100) + (data.textContent.length > 100 ? '...' : '') : '(none)' },
        { key: 'epLabelDims', kind: 'dims', value: data.rect ? `${data.rect.w} x ${data.rect.h} px` : '--' },
        { key: 'epLabelVisibility', kind: 'visibility', value: data.visibility || '--' },
        { key: 'epLabelPosition', kind: 'position', value: data.position || '--' },
        { key: 'epLabelComputed', kind: 'computed', value: data.computed || '--' },
    ];
}

// The one-line summary under the panel title, as displayElementInfo() builds it.
export function selectionSummaryOf(data: InspectedData): string {
    const summary = [ data.tag || '?' ];
    if ( data.id ) { summary.push('#' + data.id); }
    if ( data.classes.length ) { summary.push('.' + data.classes[0]); }
    return `${summary.join('')} on ${data.hostname || 'the current page'}`;
}

// "3 of 12 filters" while the history search box is in use.
export function historyCountLabel(visible: number, total: number, searching: boolean): string {
    return searching
        ? `${visible} of ${total} filter${total === 1 ? '' : 's'}`
        : pluralLabel(total, 'filter');
}

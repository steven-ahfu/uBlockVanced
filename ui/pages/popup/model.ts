// Pure derivations from PopupData. Mirrors the logic of upstream
// src/js/popup-fenix.js (renderPrivacyExposure, expandHostnameStats,
// buildAllFirewallRows, updateFirewallCell*, section bits) without any DOM.
import punycode from '../../../src/lib/punycode.js';
import type { Counts, FilterExpressions, HostnameEntry, PopupData, RuleAction, RuleScope } from './types';

const reIP = /(\d|\])$/;

// https://github.com/gorhill/uBlock/issues/2550
const reCyrillicNonAmbiguous = /[Ѐ-ЫЭ-Ябвдж-нтфц-щы-єїљ-ѠѢ-ѴѶ-ҺҼҾ-ӎӐ-ԀԂ-ԚԜԞ-ԯ]/;
const reCyrillicAmbiguous = /[Ьагеопрсухъѕіјѡѵһҽӏԁԛԝ]/;

export const gtz = (n: unknown): boolean => typeof n === 'number' && n > 0;

export interface HostRow {
    des: string;
    domain: string;
    isDomain: boolean;
    isSubdomain: boolean;
    isRootContext: boolean;
    is3p: boolean;
    hasSubdomains: boolean;
    hasScript: boolean;
    hasFrame: boolean;
    isCname: boolean;
    prettyName: string;
    extra: string;
    counts: { allowed: Counts; blocked: Counts };
    totals?: { allowed: Counts; blocked: Counts };
}

export interface FirewallModel {
    rows: HostRow[];
    a1pScript: number; b1pScript: number;
    a3pScript: number; b3pScript: number;
    a3pFrame: number; b3pFrame: number;
    touchedDomainCount: number;
    allDomainCount: number;
}

export function cnameMapOf(data: PopupData): Map<string, string> {
    return data.cnameMap instanceof Map
        ? data.cnameMap
        : new Map(data.cnameMap || []);
}

function sortableTokens(data: PopupData): Map<string, string> {
    const map = new Map<string, string>();
    const dict = data.hostnameDict || {};
    for ( const hostname of Object.keys(dict) ) {
        let domain = dict[hostname].domain;
        const prefix = hostname.slice(0, 0 - domain.length - 1);
        // First-party hostnames sort first.
        if ( domain === data.pageDomain ) { domain = ' '; }
        map.set(hostname, domain + ' ' + prefix.split('.').reverse().join('.'));
    }
    return map;
}

export function buildFirewallModel(data: PopupData): FirewallModel {
    const dict = data.hostnameDict || {};
    const tokens = sortableTokens(data);
    const compare = (a: string, b: string): number => {
        const ha = reIP.test(a) ? a : (tokens.get(a) || ' ');
        const hb = reIP.test(b) ? b : (tokens.get(b) || ' ');
        const ca = ha.charCodeAt(0);
        const cb = hb.charCodeAt(0);
        return ca !== cb ? ca - cb : ha.localeCompare(hb);
    };

    // renderPrivacyExposure
    const allDomains: Record<string, boolean> = {};
    let allDomainCount = 0;
    let touchedDomainCount = 0;
    const hasSubdomains = new Map<string, boolean>();
    const order: string[] = [];
    const done = new Set<string>();
    for ( const des of Object.keys(dict).sort(compare) ) {
        if ( des === '*' || done.has(des) ) { continue; }
        const { domain, counts } = dict[des];
        if ( Object.hasOwn(allDomains, domain) === false ) {
            allDomains[domain] = false;
            allDomainCount += 1;
        }
        if ( gtz(counts.allowed.any) && allDomains[domain] === false ) {
            allDomains[domain] = true;
            touchedDomainCount += 1;
        }
        if ( dict[domain] !== undefined ) {
            if ( des !== domain ) {
                hasSubdomains.set(domain, true);
            } else if ( hasSubdomains.has(domain) === false ) {
                hasSubdomains.set(domain, false);
            }
        }
        order.push(des);
        done.add(des);
    }

    // expandHostnameStats
    const cname = cnameMapOf(data);
    const rows: HostRow[] = [];
    let dn: HostRow | undefined;
    for ( const des of order ) {
        const entry: HostnameEntry = dict[des];
        const isDomain = des === entry.domain;
        const { allowed, blocked } = entry.counts;
        const row: HostRow = {
            des,
            domain: entry.domain,
            isDomain,
            isSubdomain: !isDomain,
            isRootContext: des === data.pageHostname,
            is3p: entry.domain !== data.pageDomain,
            hasSubdomains: isDomain && hasSubdomains.get(des) === true,
            hasScript: allowed.script !== 0 || blocked.script !== 0,
            hasFrame: allowed.frame !== 0 || blocked.frame !== 0,
            isCname: cname.has(des),
            prettyName: des,
            extra: '',
            counts: entry.counts,
        };
        if ( isDomain ) {
            row.totals = JSON.parse(JSON.stringify(entry.counts));
            dn = row;
        } else if ( dn !== undefined && dn.totals !== undefined ) {
            dn.totals.allowed.any += allowed.any;
            dn.totals.blocked.any += blocked.any;
        }
        if ( dn !== undefined && dn !== row ) {
            dn.hasScript = dn.hasScript || row.hasScript;
            dn.hasFrame = dn.hasFrame || row.hasFrame;
        }
        const pretty = des.includes('xn--') ? punycode.toUnicode(des) : des;
        row.prettyName = pretty;
        if ( row.isCname ) {
            row.extra = punycode.toUnicode(cname.get(des) as string);
        } else if (
            isDomain && pretty !== des &&
            reCyrillicAmbiguous.test(pretty) &&
            reCyrillicNonAmbiguous.test(pretty) === false
        ) {
            row.extra = des;
        }
        rows.push(row);
    }

    let a1pScript = 0, b1pScript = 0;
    let a3pScript = 0, b3pScript = 0;
    let a3pFrame = 0, b3pFrame = 0;
    for ( const row of rows ) {
        const { allowed, blocked } = row.counts;
        if ( row.domain === data.pageDomain ) {
            a1pScript += allowed.script; b1pScript += blocked.script;
        } else {
            a3pScript += allowed.script; b3pScript += blocked.script;
            a3pFrame += allowed.frame; b3pFrame += blocked.frame;
        }
    }

    return {
        rows,
        a1pScript, b1pScript, a3pScript, b3pScript, a3pFrame, b3pFrame,
        touchedDomainCount, allDomainCount,
    };
}

/******************************************************************************/

export const countLevel = (n: number | undefined): string =>
    gtz(n) ? String(Math.min(Math.ceil(Math.log((n as number) + 1) / Math.LN10), 3)) : '0';

const actionNames: Record<string, string> = { '1': 'block', '2': 'allow', '3': 'noop' };

export interface CellRule {
    className: string; // '' | 'blockRule' | 'allowRule ownRule' ...
}

export function cellRuleClass(
    data: PopupData,
    scope: RuleScope,
    des: string,
    type: string,
): string {
    const rule = data.firewallRules?.[`${scope} ${des} ${type}`];
    if ( rule === undefined ) { return ''; }
    const parts = rule.split(' ');
    const classes = [ `${actionNames[parts[3]]}Rule` ];
    const srcHostname = scope === '/' ? '*' : (data.pageHostname || '');
    if (
        (parts[1] !== '*' || parts[2] === type) &&
        parts[1] === des &&
        parts[0] === srcHostname
    ) {
        classes.push('ownRule');
    }
    return classes.join(' ');
}

/******************************************************************************/

// Popup state hash: which changes require a page reload to take effect.
export function popupHash(data: PopupData, off: boolean): string {
    const hasher: string[] = [];
    const rules = data.firewallRules || {};
    for ( const key of Object.keys(rules) ) {
        const rule = rules[key];
        if ( rule === undefined ) { continue; }
        hasher.push(rule);
    }
    hasher.sort();
    hasher.push(
        String(off),
        String(data.noLargeMedia === true),
        String(data.noCosmeticFiltering === true),
        String(data.noRemoteFonts === true),
        String(data.noScripting === true),
    );
    return hasher.join('');
}

/******************************************************************************/

// Sections: the popup is made of sections whose visibility is toggled with
// the more/less buttons and persisted as a bit set.
export const maxNumberOfSections = 6;
export const retiredSectionBits = 0b00011;
export const sectionFirewallBit = 0b10000;

export const sanitizeSectionBits = (bits: number): number => bits & ~retiredSectionBits;

export const disabledSectionBits = (data: PopupData | null): number =>
    ((data?.popupPanelDisabledSections ?? 0) | retiredSectionBits);

export const lockedSectionBits = (data: PopupData | null): number =>
    sanitizeSectionBits(data?.popupPanelLockedSections ?? 0);

export const computedSections = (data: PopupData): number =>
    sanitizeSectionBits(
        (data.popupPanelSections & ~disabledSectionBits(data)) | lockedSectionBits(data)
    );

export function sectionBitsToAttribute(bits: number): string {
    let attr = '';
    for ( let i = 0; i < maxNumberOfSections; i++ ) {
        if ( (bits & (1 << i)) === 0 ) { continue; }
        attr += String.fromCharCode(97 + i);
    }
    return attr;
}

export function nextSectionBits(data: PopupData | null, current: number, more: boolean): number {
    const offbits = ~disabledSectionBits(data);
    const onbits = lockedSectionBits(data);
    const currentBits = sanitizeSectionBits(current);
    let newBits = currentBits;
    for ( let i = 0; i < maxNumberOfSections; i++ ) {
        const bit = 1 << (more ? i : maxNumberOfSections - i - 1);
        if ( more ) { newBits |= bit; } else { newBits &= ~bit; }
        newBits = sanitizeSectionBits((newBits & offbits) | onbits);
        if ( newBits !== currentBits ) { break; }
    }
    return newBits;
}

export function sectionsMinMax(data: PopupData | null): { min: string; max: string } {
    return {
        min: sectionBitsToAttribute(lockedSectionBits(data)),
        max: sectionBitsToAttribute(((1 << maxNumberOfSections) - 1) & ~disabledSectionBits(data)),
    };
}

/******************************************************************************/

export const defaultFilterExpressions: FilterExpressions = {
    notA: false, blocked: false, allowed: false, notB: false, script: false, frame: false,
};

export function filterExpressionsToStorage(f: FilterExpressions): string {
    const bits = [ f.notA, f.blocked, f.allowed, f.notB, f.script, f.frame ].map(v => v ? '1' : '0');
    return [ '00', ...bits ].join(' ');
}

export function filterExpressionsFromStorage(v: unknown): FilterExpressions | null {
    if ( typeof v !== 'string' ) { return null; }
    const parts = v.split(' ');
    if ( parts.shift() !== '00' ) { return null; }
    if ( parts.every(p => p === '0') ) { return null; }
    const b = (i: number): boolean => parts[i] === '1';
    return { notA: b(0), blocked: b(1), allowed: b(2), notB: b(3), script: b(4), frame: b(5) };
}

export function firewallFilterClasses(f: FilterExpressions): string[] {
    const out: string[] = [];
    if ( f.blocked ) { out.push(f.notA ? 'hideBlocked' : 'showBlocked'); }
    if ( f.allowed ) { out.push(f.notA ? 'hideAllowed' : 'showAllowed'); }
    if ( f.script ) { out.push(f.notB ? 'hide3pScript' : 'show3pScript'); }
    if ( f.frame ) { out.push(f.notB ? 'hide3pFrame' : 'show3pFrame'); }
    return out;
}

export const asRuleAction = (n: number): RuleAction => (n === 1 || n === 2 || n === 3 ? n : 0);

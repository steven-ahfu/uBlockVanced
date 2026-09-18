// Pure logic for the Filter lists page: the catalog tree, per-node rollups,
// the unsaved-changes hash and the search haystack. No DOM, no vAPI, so it
// mirrors upstream src/js/3p-filters.js behaviour in a testable form.

import { t, tOr } from '../../shared/i18n';
import type { AssetCache, ListDetails, ListsetDetails } from './types';

export const GROUP_KEYS = [
    'user', 'default', 'ads', 'privacy', 'malware', 'multipurpose',
    'cookies', 'social', 'annoyances', 'regions', 'unknown', 'custom',
];

// Low-priority stock groups stay out of the catalog without being reset.
export const HIDDEN_GROUPS = new Set([ 'regions' ]);

export const RECENTLY_UPDATED = 60 * 60 * 1000; // 1 hour

export interface LeafNode {
    kind: 'leaf';
    key: string;
    title: string;
    details: ListDetails;
}

export interface BranchNode {
    kind: 'group' | 'node';
    key: string;
    title: string;
    preferred?: boolean;
    children: TreeNode[];
}

export type TreeNode = LeafNode | BranchNode;

export function groupName(key: string): string {
    const text = tOr('3pGroup' + key.charAt(0).toUpperCase() + key.slice(1), '');
    if ( text !== '' ) { return text; }
    return key.charAt(0).toLocaleUpperCase() + key.slice(1);
}

export const groupKeyOf = (d: ListDetails): string => d.group2 || d.group || '';

export const isHiddenList = (d: ListDetails): boolean => HIDDEN_GROUPS.has(groupKeyOf(d));

export function hiddenListKeys(details: ListsetDetails): string[] {
    return Object.entries(details.available)
        .filter(([ , d ]) => isHiddenList(d))
        .map(([ key ]) => key);
}

interface RawBranch { title: string; preferred?: boolean; lists: Record<string, ListDetails | RawBranch> }
const isRawBranch = (v: ListDetails | RawBranch): v is RawBranch => 'lists' in v;

const reEmojis = /\p{Emoji}+/gu;

function toNodes(parent: Record<string, ListDetails | RawBranch>, depth: number): TreeNode[] {
    const entries = Object.entries(parent);
    if ( depth !== 0 ) {
        entries.sort((a, b) => {
            const ap = a[1].preferred === true;
            const bp = b[1].preferred === true;
            if ( ap !== bp ) { return ap ? -1 : 1; }
            const as = (a[1].title || a[0]).replace(reEmojis, '');
            const bs = (b[1].title || b[0]).replace(reEmojis, '');
            return as.localeCompare(bs);
        });
    }
    return entries.map(([ key, value ]) => {
        if ( isRawBranch(value) ) {
            return {
                kind: depth === 0 ? 'group' : 'node',
                key,
                title: value.title,
                preferred: value.preferred,
                children: toNodes(value.lists, depth + 1),
            } as BranchNode;
        }
        return { kind: 'leaf', key, title: value.title || key, details: value } as LeafNode;
    });
}

// Same tree upstream builds in onListsReceived(): fixed group order, parents
// created on demand from `parent: "a|b"`, empty groups dropped.
export function buildTree(details: ListsetDetails): BranchNode[] {
    const tree: Record<string, RawBranch> = {};
    for ( const key of GROUP_KEYS ) {
        tree[key] = { title: groupName(key), lists: {} };
    }
    for ( const [ listkey, d ] of Object.entries(details.available) ) {
        if ( isHiddenList(d) ) { continue; }
        let groupkey = groupKeyOf(d);
        if ( Object.hasOwn(tree, groupkey) === false ) { groupkey = 'unknown'; }
        const group = tree[groupkey];
        if ( d.parent !== undefined ) {
            let lists = group.lists;
            for ( const parent of d.parent.split('|') ) {
                let branch = lists[parent];
                if ( branch === undefined || isRawBranch(branch) === false ) {
                    branch = { title: parent, lists: {} };
                    lists[parent] = branch;
                }
                if ( d.preferred === true ) { branch.preferred = true; }
                lists = branch.lists;
            }
            lists[listkey] = d;
        } else {
            const current = details.current[listkey] || details.available[listkey];
            group.lists[listkey] = { ...d, title: (current && current.title) || listkey };
        }
    }
    for ( const key of GROUP_KEYS ) {
        if ( Object.keys(tree[key].lists).length === 0 ) { delete tree[key]; }
    }
    return toNodes(tree, 0) as BranchNode[];
}

export function leavesOf(node: TreeNode): LeafNode[] {
    if ( node.kind === 'leaf' ) { return [ node ]; }
    const out: LeafNode[] = [];
    for ( const child of node.children ) { out.push(...leavesOf(child)); }
    return out;
}

export interface Selection {
    checked: ReadonlySet<string>;
    toRemove: ReadonlySet<string>;
}

// Everything the leaf row needs to decide which status icons to show.
export interface LeafStatus {
    on: boolean;
    unsecure: boolean;
    failed: boolean;
    obsolete: boolean;
    cached: boolean;
    recent: boolean;
    writeTime: number;
}

export function leafStatus(key: string, details: ListsetDetails, sel: Selection): LeafStatus {
    const asset: AssetCache = details.cache[key] || {};
    const writeTime = asset.writeTime || 0;
    return {
        on: sel.checked.has(key),
        unsecure: typeof asset.remoteURL === 'string' && asset.remoteURL.startsWith('http:'),
        failed: asset.error !== undefined,
        obsolete: asset.obsolete === true,
        cached: asset.cached === true,
        recent: asset.cached === true && Date.now() - writeTime < RECENTLY_UPDATED,
        writeTime,
    };
}

export interface NodeRollup {
    checkedCount: number;
    leafCount: number;
    used: number;
    total: number;
    cached: boolean;
    obsolete: boolean;
    latestWriteTime: number;
    oldestWriteTime: number;
    first: LeafNode | null;
}

// Same numbers upstream updateListNode() derives from the DOM.
export function nodeRollup(node: BranchNode, details: ListsetDetails, sel: Selection): NodeRollup {
    const leaves = leavesOf(node);
    const r: NodeRollup = {
        checkedCount: 0, leafCount: leaves.length, used: 0, total: 0,
        cached: false, obsolete: false,
        latestWriteTime: 0, oldestWriteTime: Number.MAX_SAFE_INTEGER,
        first: leaves[0] ?? null,
    };
    for ( const leaf of leaves ) {
        if ( sel.checked.has(leaf.key) === false ) { continue; }
        r.checkedCount += 1;
        const d = details.available[leaf.key] || leaf.details;
        r.used += d.off ? 0 : d.entryUsedCount || 0;
        r.total += d.entryCount || 0;
        const asset = details.cache[leaf.key] || {};
        r.cached = r.cached || asset.cached === true;
        r.obsolete = r.obsolete || asset.obsolete === true;
        r.latestWriteTime = Math.max(r.latestWriteTime, asset.writeTime || 0);
        r.oldestWriteTime = Math.min(r.oldestWriteTime, asset.writeTime || Number.MAX_SAFE_INTEGER);
    }
    return r;
}

// Hash of the settings that decide which lists are loaded, as stored.
export function hashFromDetails(details: ListsetDetails): string {
    const keys: string[] = [];
    for ( const [ key, d ] of Object.entries(details.available) ) {
        if ( d.off === true ) { continue; }
        keys.push(key);
    }
    return [
        details.parseCosmeticFilters === true,
        details.ignoreGenericCosmeticFilters === true,
        keys.sort().join(),
        '',
        false,
    ].join();
}

export interface CurrentSettings {
    parseCosmeticFilters: boolean;
    ignoreGenericCosmeticFilters: boolean;
    importText: string;
}

// Hash of what the page currently shows; differs from hashFromDetails()
// exactly when there is something to apply.
export function hashFromCurrent(
    details: ListsetDetails,
    leafKeys: string[],
    sel: Selection,
    settings: CurrentSettings,
): string {
    const keys: string[] = [];
    for ( const key of leafKeys ) {
        if ( sel.toRemove.has(key) ) { continue; }
        if ( sel.checked.has(key) === false ) { continue; }
        keys.push(key);
    }
    for ( const key of hiddenListKeys(details) ) {
        if ( details.available[key].off === true ) { continue; }
        keys.push(key);
    }
    return [
        settings.parseCosmeticFilters,
        settings.ignoreGenericCosmeticFilters,
        keys.sort().join(),
        settings.importText.trim(),
        sel.toRemove.size !== 0,
    ].join();
}

const tagsToI18n = (tags: string): string => {
    if ( tags === '' ) { return ''; }
    return tags.toLowerCase().split(/\s+/).reduce((a, v) => {
        let s = tOr(v, '');
        if ( s === '' ) {
            s = groupName(v);
            if ( s === '' ) { return a; }
        }
        return `${a} ${s}`.trim();
    }, '');
};

export function haystack(leaf: LeafNode): string {
    const d = leaf.details;
    const groupkey = groupKeyOf(d);
    return [
        leaf.title,
        groupkey,
        groupName(groupkey),
        d.tags || '',
        tagsToI18n(d.tags || ''),
    ].join(' ').trim();
}

export function searchRegExp(pattern: string): RegExp | null {
    if ( pattern === '' ) { return null; }
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

export const renderLeafStats = (used: number, total: number): string => {
    if ( Number.isNaN(used) || Number.isNaN(total) ) { return ''; }
    return t('3pListsOfBlockedHostsPerListStats')
        .replace('{{used}}', used.toLocaleString())
        .replace('{{total}}', total.toLocaleString());
};

export const reValidExternalList = /^[a-z-]+:\/\/(?:\S+\/\S*|\/\S+)/m;

import { useEffect, useState } from 'react';
import { t, tOr } from '../../shared/i18n';
import { send, storage } from '../../shared/vapi';

// State for the strict-blocking interstitial. `?details=` carries the
// blocked URL, hostname, the matching filter and an optional reason and
// redirect target, exactly as upstream document-blocked.js reads it.

export interface BlockedDetails {
    url?: string;
    hn?: string;
    fs?: string;
    reason?: string;
    to?: string;
}

export interface FilterListRef {
    assetKey: string;
    title: string;
    supportURL?: string;
    reason?: string;
}

export interface DocumentBlockedState {
    details: BlockedDetails;
    hostname: string;
    permanent: boolean;
    expanded: boolean;
    canParse: boolean;
    reason: string;
    lists: FilterListRef[];
    ready: boolean;
    canGoBack: boolean;
}

export interface DocumentBlockedActions {
    setPermanent(value: boolean): void;
    toggleExpanded(): void;
    proceed(): Promise<void>;
    back(): void;
    close(): void;
}

function parseDetails(): BlockedDetails {
    const details: BlockedDetails = {};
    const matches = /details=([^&]+)/.exec(window.location.search);
    if ( matches !== null ) {
        try {
            Object.assign(details, JSON.parse(decodeURIComponent(matches[1])));
        } catch {
            // Malformed or truncated payload: fall back to empty details.
        }
    }
    return details;
}

export function hostnameOf(details: BlockedDetails): string {
    if ( details.hn ) { return details.hn; }
    try {
        return new URL(details.url ?? '').hostname;
    } catch {
        return details.url || 'this site';
    }
}

export const reURL = /^https?:\/\//;

// True when the URL has a query string worth showing (upstream renderParams).
export function hasParams(rawURL: string | undefined): boolean {
    try {
        return new URL(rawURL ?? '').search.length > 1;
    } catch {
        return false;
    }
}

export function useDocumentBlocked(): [ DocumentBlockedState, DocumentBlockedActions ] {
    const [ details ] = useState<BlockedDetails>(parseDetails);
    const hostname = hostnameOf(details);
    const [ permanent, setPermanent ] = useState(false);
    const [ expanded, setExpanded ] = useState(false);
    const [ reason, setReason ] = useState('');
    const [ lists, setLists ] = useState<FilterListRef[]>([]);
    const [ ready, setReady ] = useState(false);
    const canParse = hasParams(details.url);
    const canGoBack = window.history.length > 1;

    useEffect(() => {
        if ( canParse === false ) { return; }
        storage.get<string | boolean>('document-blocked-expand-url').then(value => {
            setExpanded(value === 'true' || value === true);
        });
    }, [ canParse ]);

    useEffect(() => {
        let disposed = false;
        (async () => {
            let found: FilterListRef[] = [];
            const response = await send<Record<string, FilterListRef[]> | null>('documentBlocked', {
                what: 'listsFromNetFilter',
                rawFilter: details.fs,
            });
            if ( response instanceof Object ) {
                for ( const rawFilter in response ) {
                    if ( Object.hasOwn(response, rawFilter) ) {
                        found = response[rawFilter] || [];
                        break;
                    }
                }
            }
            if ( disposed ) { return; }
            let why = details.reason;
            if ( !why ) {
                why = found.reduce<string | undefined>((a, b) => a || b.reason, undefined);
            }
            if ( why ) {
                const msg = tOr(`docblockedReason${why.charAt(0).toUpperCase()}${why.slice(1)}`, '');
                if ( msg ) { why = msg; }
            }
            setReason(why || '');
            setLists(found);
            setReady(true);
        })();
        return () => { disposed = true; };
    }, [ details ]);

    const proceedToURL = () => { window.location.replace(details.url ?? ''); };

    const proceed = async () => {
        if ( permanent ) {
            await send('documentBlocked', {
                what: 'toggleHostnameSwitch',
                name: 'no-strict-blocking',
                hostname: details.hn,
                deep: true,
                state: true,
                persist: true,
            });
        } else {
            await send('documentBlocked', { what: 'temporarilyWhitelistDocument', hostname: details.hn });
        }
        proceedToURL();
    };

    const toggleExpanded = () => {
        setExpanded(prev => {
            storage.set('document-blocked-expand-url', (!prev).toString());
            return !prev;
        });
    };

    const state: DocumentBlockedState = {
        details, hostname, permanent, expanded, canParse, reason, lists, ready, canGoBack,
    };
    const actions: DocumentBlockedActions = {
        setPermanent,
        toggleExpanded,
        proceed,
        back: () => { window.history.back(); },
        close: () => { send('documentBlocked', { what: 'closeThisTab' }); },
    };
    void t;
    return [ state, actions ];
}

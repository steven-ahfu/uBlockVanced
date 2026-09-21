import { useEffect, useRef, useState } from 'react';
import { t, tf } from '../../shared/i18n';
import { send } from '../../shared/vapi';

// Owns the read-only CodeMirror instance and the asset load, the same way
// upstream asset-viewer.js does: `?url=` names the asset, `?subscribe`
// shows the subscribe card, `?title=` overrides the heading.

export type Tone = 'neutral' | 'running' | 'success' | 'warning' | 'muted';
export interface Pill { text: string; tone: Tone }

interface AssetContent {
    content?: string;
    sourceURL?: string;
    trustedSource?: boolean;
    assetKey?: string;
}

export interface AssetViewerState {
    assetKey: string | null;
    title: string;
    meta: string;
    status: Pill;
    trust: Pill | null;
    lines: Pill | null;
    sourceURL: string;
    loading: boolean;
    subscribe: boolean;
    subscribeState: Pill;
    subscribeBusy: boolean;
    subscribed: boolean;
}

export interface AssetViewerActions {
    subscribe(): Promise<void>;
}

const lineCount = (text: string): number => (text === '' ? 0 : text.split(/\r\n|\r|\n/).length);

export function useAssetViewer(): [ React.RefObject<HTMLDivElement | null>, AssetViewerState, AssetViewerActions ] {
    const host = useRef<HTMLDivElement>(null);
    const params = useRef(new URL(document.location.href)).current;
    const assetKey = params.searchParams.get('url');
    const title = params.searchParams.get('title') || assetKey || t('assetViewerUntitledAsset');
    const wantsSubscribe = params.searchParams.get('subscribe') !== null;

    const [ status, setStatus ] = useState<Pill>({ text: t('assetViewerStatusLoading'), tone: 'running' });
    const [ trust, setTrust ] = useState<Pill | null>(null);
    const [ lines, setLines ] = useState<Pill | null>(null);
    const [ sourceURL, setSourceURL ] = useState('');
    const [ loading, setLoading ] = useState(true);
    const [ subscribed, setSubscribed ] = useState(params.hash === '#subscribed');
    const [ subscribeState, setSubscribeState ] = useState<Pill>({ text: t('assetViewerSubscribePending'), tone: 'warning' });
    const [ subscribeBusy, setSubscribeBusy ] = useState(false);

    useEffect(() => {
        if ( host.current === null ) { return; }
        if ( assetKey === null ) {
            setStatus({ text: t('assetViewerStatusMissing'), tone: 'warning' });
            setLoading(false);
            return;
        }
        let disposed = false;
        const cm = new CodeMirror(host.current, {
            autofocus: true,
            foldGutter: true,
            gutters: [
                'CodeMirror-linenumbers',
                { className: 'CodeMirror-lintgutter', style: 'width: 11px' },
            ],
            lineNumbers: true,
            lineWrapping: true,
            matchBrackets: true,
            maxScanLines: 1,
            maximizable: false,
            readOnly: true,
            styleActiveLine: { nonEmpty: true },
        });
        uBlockDashboard.patchCodeMirrorEditor(cm);

        send<Record<string, unknown> | null>('dashboard', { what: 'getAutoCompleteDetails' }).then(hints => {
            if ( disposed || hints instanceof Object === false ) { return; }
            cm.setOption('uboHints', hints);
        });
        send<unknown>('dashboard', { what: 'getTrustedScriptletTokens' }).then(tokens => {
            if ( disposed === false ) { cm.setOption('trustedScriptletTokens', tokens); }
        });

        (async () => {
            let details: AssetContent;
            try {
                details = await send<AssetContent>('default', { what: 'getAssetContent', url: assetKey });
            } catch ( reason ) {
                if ( disposed ) { return; }
                const message = `${reason instanceof Error ? reason.message : reason || ''}`.trim();
                setStatus({ text: t('assetViewerStatusLoadError'), tone: 'warning' });
                setTrust({ text: t('assetViewerStatusUnavailable'), tone: 'muted' });
                cm.setValue(`${t('assetViewerLoadError')}${message !== '' ? `\n\n${message}` : ''}`);
                setLoading(false);
                return;
            }
            if ( disposed ) { return; }
            const content = (details && details.content) || '';
            const trusted = details.trustedSource === true;
            cm.setOption('trustedSource', trusted);
            cm.setValue(content);
            setStatus({ text: t('assetViewerStatusReady'), tone: 'success' });
            setTrust({ text: t(trusted ? 'assetViewerStatusTrusted' : 'assetViewerStatusExternal'), tone: trusted ? 'success' : 'warning' });
            setLines({ text: tf('assetViewerLineCount', { count: lineCount(content) }), tone: 'muted' });
            if ( details.sourceURL ) {
                setSourceURL(details.sourceURL);
                // The upstream search panel carries its own source link.
                const a = document.querySelector('.cm-search-widget .sourceURL');
                if ( a instanceof HTMLAnchorElement ) {
                    a.href = details.sourceURL;
                    a.title = details.sourceURL;
                    a.rel = 'noopener noreferrer';
                }
            }
            setLoading(false);
        })();
        return () => { disposed = true; };
    }, [ assetKey ]);

    const subscribe = async () => {
        if ( assetKey === null || subscribeBusy ) { return; }
        setSubscribeBusy(true);
        setSubscribeState({ text: t('assetViewerSubscribeWorking'), tone: 'running' });
        setStatus({ text: t('assetViewerStatusSubscribing'), tone: 'running' });
        try {
            await send('scriptlets', { what: 'applyFilterListSelection', toImport: assetKey });
            await send('scriptlets', { what: 'reloadAllFilters' });
        } catch {
            setSubscribeBusy(false);
            setSubscribeState({ text: t('assetViewerSubscribeError'), tone: 'warning' });
            setStatus({ text: t('assetViewerStatusSubscribeError'), tone: 'warning' });
            return;
        }
        setSubscribeState({ text: t('assetViewerSubscribeDone'), tone: 'success' });
        setStatus({ text: t('assetViewerStatusSubscribed'), tone: 'success' });
        setSubscribed(true);
        setSubscribeBusy(false);
        window.history.replaceState(null, '', '#subscribed');
    };

    const state: AssetViewerState = {
        assetKey,
        title,
        meta: assetKey || t('assetViewerNoAssetSelected'),
        status, trust, lines, sourceURL, loading,
        subscribe: wantsSubscribe && assetKey !== null,
        subscribeState, subscribeBusy, subscribed,
    };
    return [ host, state, { subscribe } ];
}

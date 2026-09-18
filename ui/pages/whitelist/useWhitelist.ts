import { useCallback, useEffect, useRef, useState } from 'react';
import { t, tf } from '../../shared/i18n';
import { send } from '../../shared/vapi';
import { directiveFromLine, reComment } from './useEditor';
import type { EditorHandle, WhitelistRules } from './useEditor';

declare global {
    interface Window {
        hasUnsavedData?: () => boolean;
        wikilink?: string;
        cloud?: {
            onPush: (() => unknown) | null;
            onPull: ((data: unknown, append: boolean) => void) | null;
        };
    }
}

interface WhitelistResponse {
    whitelist: string[];
    whitelistDefault: string[];
    reBadHostname: string;
    reHostnameExtractor: string;
}

export interface WhitelistState {
    ready: boolean;
    changed: boolean;
    bad: boolean;
    hasContent: boolean;
    customCount: number;
    saveLabel: string;
    validationLabel: string;
    countLabel: string;
}

export interface WhitelistActions {
    apply(): Promise<void>;
    revert(): void;
    importFile(file: File): void;
    exportText(): void;
    /** Recompute the status after an editor change. */
    sync(): void;
}

// Same state machine as upstream whitelist.js: the editor text is compared
// against the last applied list, and a `.cm-error` token anywhere blocks Apply.
export function useWhitelist(
    editor: EditorHandle | null,
    rules: React.RefObject<WhitelistRules | null>,
): [ WhitelistState, WhitelistActions ] {
    const [ ready, setReady ] = useState(false);
    const [ changed, setChanged ] = useState(false);
    const [ bad, setBad ] = useState(false);
    const [ hasContent, setHasContent ] = useState(false);
    const [ customCount, setCustomCount ] = useState(0);
    const cached = useRef('');
    const editorRef = useRef(editor);
    editorRef.current = editor;

    const sync = useCallback(() => {
        const ed = editorRef.current;
        if ( ed === null ) { return; }
        const text = ed.getText().trim();
        const isBad = ed.host.querySelector('.cm-error') !== null;
        const defaults = rules.current?.defaults ?? new Set<string>();
        let count = 0;
        for ( const line of text === '' ? [] : text.split(/\n+/) ) {
            if ( reComment.test(line) ) { continue; }
            const directive = directiveFromLine(line);
            if ( directive === '' ) { continue; }
            if ( defaults.has(directive) ) { continue; }
            count += 1;
        }
        setChanged(text !== cached.current);
        setBad(isBad);
        setHasContent(text !== '');
        setCustomCount(count);
    }, [ rules ]);
    const syncRef = useRef(sync);
    syncRef.current = sync;

    const load = useCallback(async () => {
        const ed = editorRef.current;
        if ( ed === null ) { return; }
        const details = await send<WhitelistResponse>('dashboard', { what: 'getWhitelist' });
        const first = rules.current === null;
        if ( first ) {
            rules.current = {
                reBadHostname: new RegExp(details.reBadHostname),
                reHostnameExtractor: new RegExp(details.reHostnameExtractor),
                defaults: new Set(details.whitelistDefault),
            };
        }
        const defaults = rules.current!.defaults;
        const toAdd = new Set(defaults);
        for ( const line of details.whitelist ) {
            const directive = directiveFromLine(line);
            if ( defaults.has(directive) === false ) { continue; }
            toAdd.delete(directive);
            if ( toAdd.size === 0 ) { break; }
        }
        if ( toAdd.size !== 0 ) {
            details.whitelist.push(...Array.from(toAdd).map(a => `# ${a}`));
        }
        details.whitelist.sort((a, b) => {
            const ad = directiveFromLine(a);
            const bd = directiveFromLine(b);
            const abuiltin = defaults.has(ad);
            if ( abuiltin !== defaults.has(bd) ) { return abuiltin ? -1 : 1; }
            return ad.localeCompare(bd);
        });
        const whitelistStr = details.whitelist.join('\n').trim();
        cached.current = whitelistStr;
        ed.setText(whitelistStr);
        if ( first ) { ed.cm.clearHistory(); }
        syncRef.current();
        setReady(true);
    }, [ rules ]);

    useEffect(() => {
        if ( editor === null ) { return; }
        load();
    }, [ editor, load ]);

    // Dashboard shell + cloud widget contracts.
    useEffect(() => {
        self.hasUnsavedData = () => (editorRef.current?.getText().trim() ?? '') !== cached.current;
        self.wikilink = 'https://github.com/gorhill/uBlock/wiki/Dashboard:-Trusted-sites';
        const cloud = self.cloud;
        if ( cloud === undefined ) { return; }
        cloud.onPush = () => editorRef.current?.getText() ?? '';
        cloud.onPull = (data, append) => {
            const ed = editorRef.current;
            if ( ed === null || typeof data !== 'string' ) { return; }
            const text = append ? uBlockDashboard.mergeNewLines(ed.getText().trim(), data) : data;
            ed.setText(text.trim());
            syncRef.current();
        };
        return () => { cloud.onPush = null; cloud.onPull = null; };
    }, []);

    const apply = useCallback(async () => {
        const ed = editorRef.current;
        if ( ed === null ) { return; }
        if ( ed.host.querySelector('.cm-error') !== null ) { return; }
        cached.current = ed.getText().trim();
        await send('dashboard', { what: 'setWhitelist', whitelist: cached.current });
        load();
    }, [ load ]);

    const revert = useCallback(() => {
        editorRef.current?.setText(cached.current);
    }, []);

    const importFile = useCallback((file: File) => {
        const ed = editorRef.current;
        if ( ed === null || file.name === '' || file.type.indexOf('text') !== 0 ) { return; }
        const fr = new FileReader();
        fr.onload = ev => {
            if ( ev.type !== 'load' || typeof fr.result !== 'string' ) { return; }
            ed.setText(uBlockDashboard.mergeNewLines(ed.getText().trim(), fr.result.trim()));
        };
        fr.readAsText(file);
    }, []);

    const exportText = useCallback(() => {
        const val = editorRef.current?.getText() ?? '';
        if ( val === '' ) { return; }
        const filename = t('whitelistExportFilename')
            .replace('{{datetime}}', uBlockDashboard.dateNowToSensibleString())
            .replace(/ +/g, '_');
        vAPI.download({ url: `data:text/plain;charset=utf-8,${encodeURIComponent(val + '\n')}`, filename });
    }, []);

    const state: WhitelistState = {
        ready, changed, bad, hasContent, customCount,
        saveLabel: t(changed ? 'whitelistStatusUnsaved' : 'whitelistStatusSaved'),
        validationLabel: t(bad ? 'whitelistStatusNeedsReview' : 'whitelistStatusValid'),
        countLabel: tf('whitelistDirectiveCount', { count: customCount }),
    };
    const actions: WhitelistActions = {
        apply, revert, importFile, exportText,
        sync: () => { syncRef.current(); },
    };
    return [ state, actions ];
}

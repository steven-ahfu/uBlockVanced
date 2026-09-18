import { useCallback, useEffect, useRef, useState } from 'react';
import { send } from '../../shared/vapi';
import { modeTables } from './useEditor';

declare global {
    interface Window {
        hasUnsavedData?: () => boolean;
        wikilink?: string;
    }
}

interface HiddenSettingsResponse {
    default: Record<string, unknown>;
    admin: Record<string, unknown>;
    current: Record<string, unknown>;
}

export type Tone = 'accent' | 'warning' | 'success' | 'muted';

export interface AdvancedSettingsState {
    ready: boolean;
    changed: boolean;
    applying: boolean;
    saveKey: string;
    saveTone: Tone;
    customizedCount: number;
    lockedCount: number;
    totalCount: number;
}

export interface AdvancedSettingsActions {
    apply(): Promise<void>;
    revert(): Promise<void>;
    /** Recompute the unsaved state after an editor change (debounced). */
    sync(): void;
}

const arrayFromObject = (o: Record<string, unknown>): Array<[ string, string ]> =>
    Object.entries(o).map(([ k, v ]) => [ k, `${v}` ]);

const arrayFromString = (s: string): Array<[ string, string ]> => {
    const out: Array<[ string, string ]> = [];
    for ( let line of s.split(/[\n\r]+/) ) {
        line = line.trim();
        if ( line === '' ) { continue; }
        const pos = line.indexOf(' ');
        const k = pos !== -1 ? line.slice(0, pos) : line;
        const v = pos !== -1 ? line.slice(pos + 1) : '';
        out.push([ k.trim(), v.trim() ]);
    }
    return out;
};

const hashFrom = (raw: string | Record<string, unknown>): string => {
    const aa = typeof raw === 'string' ? arrayFromString(raw) : arrayFromObject(raw);
    aa.sort((a, b) => a[0].localeCompare(b[0]));
    return JSON.stringify(aa);
};

const countCustomized = (raw: string, defaults: Map<string, string>): number => {
    let count = 0;
    for ( const [ key, value ] of arrayFromString(raw) ) {
        if ( defaults.has(key) === false ) { continue; }
        if ( value !== defaults.get(key) ) { count += 1; }
    }
    return count;
};

export function useAdvancedSettings(cm: CMEditor | null): [ AdvancedSettingsState, AdvancedSettingsActions ] {
    const [ ready, setReady ] = useState(false);
    const [ changed, setChanged ] = useState(false);
    const [ applying, setApplying ] = useState(false);
    const [ override, setOverride ] = useState<{ key: string; tone: Tone } | null>(null);
    const [ customizedCount, setCustomizedCount ] = useState(0);
    const [ lockedCount, setLockedCount ] = useState(0);
    const [ totalCount, setTotalCount ] = useState(0);
    const beforeHash = useRef('');
    const rendering = useRef(false);
    const marks = useRef<Array<{ clear(): void }>>([]);
    const cmRef = useRef(cm);
    cmRef.current = cm;

    const isChanged = useCallback((): boolean => {
        const editor = cmRef.current;
        if ( editor === null ) { return false; }
        return hashFrom(editor.getValue()) !== beforeHash.current;
    }, []);

    const updateState = useCallback(() => {
        const editor = cmRef.current;
        if ( editor === null ) { return; }
        const text = editor.getValue();
        setChanged(hashFrom(text) !== beforeHash.current);
        setCustomizedCount(countCustomized(text, modeTables.defaults));
        setLockedCount(modeTables.admin.size);
        setTotalCount(modeTables.defaults.size);
    }, []);

    // Upstream: editor changes are debounced 200ms and clear any status override.
    const syncTimer = useRef(0);
    const sync = useCallback(() => {
        if ( rendering.current ) { return; }
        self.clearTimeout(syncTimer.current);
        syncTimer.current = self.setTimeout(() => {
            syncTimer.current = 0;
            setOverride(null);
            updateState();
        }, 200);
    }, [ updateState ]);

    const render = useCallback(async (first = false) => {
        const editor = cmRef.current;
        if ( editor === null ) { return; }
        const details = await send<HiddenSettingsResponse>('dashboard', { what: 'readHiddenSettings' });
        rendering.current = true;
        try {
            modeTables.defaults = new Map(arrayFromObject(details.default));
            modeTables.admin = new Map(arrayFromObject(details.admin));
            beforeHash.current = hashFrom(details.current);
            const entries = arrayFromObject(details.current);
            let max = 0;
            for ( const [ k ] of entries ) { if ( k.length > max ) { max = k.length; } }
            const pretty: string[] = [];
            const roLines: number[] = [];
            entries.forEach(([ k, v ], i) => {
                pretty.push(' '.repeat(max - k.length) + `${k} ${v}`);
                if ( modeTables.admin.has(k) ) { roLines.push(i); }
            });
            pretty.push('');
            for ( const mark of marks.current ) { mark.clear(); }
            marks.current = [];
            editor.setValue(pretty.join('\n'));
            if ( first ) { editor.clearHistory(); }
            for ( const line of roLines ) {
                marks.current.push(editor.markText({ line, ch: 0 }, { line: line + 1, ch: 0 }, { readOnly: true }));
            }
            updateState();
            editor.focus();
        } finally {
            rendering.current = false;
        }
    }, [ updateState ]);

    useEffect(() => {
        if ( cm === null ) { return; }
        render(true).then(() => { setReady(true); });
    }, [ cm, render ]);

    const apply = useCallback(async () => {
        const editor = cmRef.current;
        if ( editor === null ) { return; }
        setApplying(true);
        setOverride(null);
        try {
            await send('dashboard', { what: 'writeHiddenSettings', content: editor.getValue() });
            setApplying(false);
            setOverride({ key: 'advancedSettingsStatusApplied', tone: 'success' });
            await render();
        } catch {
            setApplying(false);
            setOverride({ key: 'advancedSettingsStatusSaveError', tone: 'warning' });
            updateState();
        }
    }, [ render, updateState ]);

    const revert = useCallback(async () => {
        setOverride({ key: 'advancedSettingsStatusReverted', tone: 'muted' });
        await render();
    }, [ render ]);

    // Ctrl-S saves only when there is something to apply, as upstream.
    useEffect(() => {
        CodeMirror.commands.save = changed && applying === false ? () => { apply(); } : () => {};
    }, [ changed, applying, apply ]);

    useEffect(() => {
        self.hasUnsavedData = () => isChanged();
        self.wikilink = 'https://github.com/gorhill/uBlock/wiki/Dashboard:-Advanced-settings';
    }, [ isChanged ]);

    let saveKey: string;
    let saveTone: Tone;
    if ( override !== null ) {
        saveKey = override.key; saveTone = override.tone;
    } else if ( applying ) {
        saveKey = 'advancedSettingsStatusSaving'; saveTone = 'accent';
    } else if ( changed ) {
        saveKey = 'advancedSettingsStatusUnsaved'; saveTone = 'warning';
    } else {
        saveKey = 'advancedSettingsStatusSaved'; saveTone = 'success';
    }

    return [
        { ready, changed, applying, saveKey, saveTone, customizedCount, lockedCount, totalCount },
        { apply, revert, sync },
    ];
}

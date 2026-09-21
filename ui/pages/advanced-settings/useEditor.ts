import { useEffect, useRef, useState } from 'react';

// Owns the CodeMirror instance for the raw settings text. CodeMirror is a
// bespoke widget (not Material): one instance, created in the ref'd host with
// the upstream options and the upstream 'raw-settings' mode, which colours
// unknown keys as errors, admin-locked keys as read-only and non-default
// values as strong. The mode reads the maps through `modeTables` so a reload
// never has to re-register it.

export interface ModeTables {
    defaults: Map<string, string>;
    admin: Map<string, string>;
}

export const modeTables: ModeTables = {
    defaults: new Map(),
    admin: new Map(),
};

let modeDefined = false;
function defineRawSettingsMode(): void {
    if ( modeDefined ) { return; }
    modeDefined = true;
    (CodeMirror as unknown as CMWithModes).defineMode('raw-settings', () => {
        let lastSetting = '';
        return {
            token(stream) {
                if ( stream.sol() ) {
                    stream.eatSpace();
                    const match = stream.match(/\S+/);
                    if ( match !== null && modeTables.defaults.has(match[0]) ) {
                        lastSetting = match[0];
                        return modeTables.admin.has(match[0]) ? 'readonly keyword' : 'keyword';
                    }
                    stream.skipToEnd();
                    return 'line-cm-error';
                }
                stream.eatSpace();
                const match = stream.match(/.*$/);
                if ( match !== null ) {
                    if ( match[0].trim() !== modeTables.defaults.get(lastSetting) ) {
                        return 'line-cm-strong';
                    }
                    if ( modeTables.admin.has(lastSetting) ) {
                        return 'readonly';
                    }
                }
                stream.skipToEnd();
                return null;
            },
        };
    });
}

export function useEditor(onChanges: () => void): [ React.RefObject<HTMLDivElement | null>, CMEditor | null ] {
    const host = useRef<HTMLDivElement>(null);
    const [ cm, setCm ] = useState<CMEditor | null>(null);
    const callbacks = useRef({ onChanges });
    callbacks.current = { onChanges };

    useEffect(() => {
        if ( host.current === null ) { return; }
        defineRawSettingsMode();
        const editor = new CodeMirror(host.current, {
            autofocus: true,
            lineNumbers: true,
            lineWrapping: false,
            mode: 'raw-settings',
            styleActiveLine: true,
        });
        uBlockDashboard.patchCodeMirrorEditor(editor);
        const onChangesHandler = () => { callbacks.current.onChanges(); };
        editor.on('changes', onChangesHandler);
        setCm(editor);
        return () => { editor.off('changes', onChangesHandler); };
    }, []);

    return [ host, cm ];
}

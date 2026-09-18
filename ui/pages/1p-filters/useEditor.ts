import { useEffect, useRef, useState } from 'react';
import { send, storage } from '../../shared/vapi';

// Owns the CodeMirror instance for the user filters. CodeMirror is a bespoke
// widget (not Material), created once inside the ref'd container with the
// same options, hints and cursor persistence as upstream 1p-filters.js.

export interface EditorHandle {
    cm: CMEditor;
    getText(): string;
    setText(text: string): void;
}

export function useEditor(onChanges: () => void, onSave: () => void): [ React.RefObject<HTMLDivElement | null>, EditorHandle | null ] {
    const host = useRef<HTMLDivElement>(null);
    const [ handle, setHandle ] = useState<EditorHandle | null>(null);
    const callbacks = useRef({ onChanges, onSave });
    callbacks.current = { onChanges, onSave };

    useEffect(() => {
        if ( host.current === null ) { return; }
        const cm = new CodeMirror(host.current, {
            autoCloseBrackets: true,
            autofocus: true,
            extraKeys: {
                'Ctrl-Space': 'autocomplete',
                'Tab': 'toggleComment',
            },
            foldGutter: true,
            gutters: [
                'CodeMirror-linenumbers',
                { className: 'CodeMirror-lintgutter', style: 'width: 11px' },
            ],
            lineNumbers: true,
            lineWrapping: true,
            matchBrackets: true,
            maxScanLines: 1,
            styleActiveLine: { nonEmpty: true },
        });
        uBlockDashboard.patchCodeMirrorEditor(cm);

        const getText = (): string => {
            const text = cm.getValue().trimEnd();
            return text === '' ? text : `${text}\n`;
        };
        const setText = (text: string): void => {
            cm.setValue(`${text.trimEnd()}\n\n`);
        };

        // Auto-complete hints depend on the open tabs, so they are polled.
        let hintUpdateToken = 0;
        let hintTimer = 0;
        let disposed = false;
        const getHints = async () => {
            const hints = await send<Record<string, unknown> | null>('dashboard', { what: 'getAutoCompleteDetails', hintUpdateToken });
            if ( disposed || hints instanceof Object === false ) { return; }
            if ( hints.hintUpdateToken !== undefined ) {
                cm.setOption('uboHints', hints);
                hintUpdateToken = hints.hintUpdateToken as number;
            }
            hintTimer = self.setTimeout(getHints, 2503);
        };
        getHints();
        send<unknown>('dashboard', { what: 'getTrustedScriptletTokens' }).then(tokens => {
            if ( disposed === false ) { cm.setOption('trustedScriptletTokens', tokens); }
        });

        // https://github.com/gorhill/uBlock/issues/3706: remember the cursor line.
        let curline = 0;
        let cursorTimer = 0;
        const onCursor = () => {
            if ( cursorTimer !== 0 ) { return; }
            if ( cm.getCursor().line === curline ) { return; }
            cursorTimer = self.setTimeout(() => {
                cursorTimer = 0;
                curline = cm.getCursor().line;
                storage.set('myFiltersCursorPosition', curline);
            }, 701);
        };
        cm.on('cursorActivity', onCursor);
        const onChangesHandler = () => { callbacks.current.onChanges(); };
        cm.on('changes', onChangesHandler);
        CodeMirror.commands.save = () => { callbacks.current.onSave(); };

        setHandle({ cm, getText, setText });
        return () => {
            disposed = true;
            self.clearTimeout(hintTimer);
            self.clearTimeout(cursorTimer);
            cm.off('cursorActivity', onCursor);
            cm.off('changes', onChangesHandler);
        };
    }, []);

    return [ host, handle ];
}

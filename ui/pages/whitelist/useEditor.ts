import { useEffect, useRef, useState } from 'react';

// Owns the CodeMirror instance for the trusted-site directives. CodeMirror is
// a bespoke widget (not Material), created once inside the ref'd container
// with the same options as upstream whitelist.js. The line mode mirrors the
// upstream "ubo-whitelist-directives" tokenizer and reads its validation
// rules from the `rules` ref, which the page fills after `getWhitelist`.

export interface WhitelistRules {
    reBadHostname: RegExp;
    reHostnameExtractor: RegExp;
    defaults: ReadonlySet<string>;
}

export interface EditorHandle {
    cm: CMEditor;
    host: HTMLDivElement;
    getText(): string;
    setText(text: string): void;
}

export const reComment = /^\s*#\s*/;

export function directiveFromLine(line: string): string {
    const match = reComment.exec(line);
    return match === null
        ? line.trim()
        : line.slice(match.index + match[0].length).trim();
}

interface CMStream { string: string; skipToEnd(): void }
interface CMWithModes {
    defineMode(name: string, factory: () => { token(stream: CMStream): string | null }): void;
}

const MODE = 'ubo-whitelist-directives';
const reRegex = /^\/.+\/$/;
let modeDefined = false;

function defineMode(rules: React.RefObject<WhitelistRules | null>): void {
    if ( modeDefined ) { return; }
    modeDefined = true;
    (CodeMirror as unknown as CMWithModes).defineMode(MODE, () => ({
        token(stream) {
            const line = stream.string.trim();
            stream.skipToEnd();
            const r = rules.current;
            if ( r === null ) { return null; }
            if ( reComment.test(line) ) { return 'comment'; }
            if ( line.indexOf('/') === -1 ) {
                if ( r.reBadHostname.test(line) ) { return 'error'; }
                return r.defaults.has(line.trim()) ? 'keyword' : null;
            }
            if ( reRegex.test(line) ) {
                try { new RegExp(line.slice(1, -1)); } catch { return 'error'; }
                return null;
            }
            if ( r.reHostnameExtractor.test(line) === false ) { return 'error'; }
            return r.defaults.has(line.trim()) ? 'keyword' : null;
        },
    }));
}

export function useEditor(
    rules: React.RefObject<WhitelistRules | null>,
    onChanges: () => void,
    onSave: () => void,
): [ React.RefObject<HTMLDivElement | null>, EditorHandle | null ] {
    const host = useRef<HTMLDivElement>(null);
    const [ handle, setHandle ] = useState<EditorHandle | null>(null);
    const callbacks = useRef({ onChanges, onSave });
    callbacks.current = { onChanges, onSave };

    useEffect(() => {
        const element = host.current;
        if ( element === null ) { return; }
        defineMode(rules);
        const cm = new CodeMirror(element, {
            autofocus: true,
            lineNumbers: true,
            lineWrapping: true,
            mode: MODE,
            styleActiveLine: true,
        });
        uBlockDashboard.patchCodeMirrorEditor(cm);

        const getText = (): string => {
            const text = cm.getValue().trimEnd();
            return text === '' ? text : `${text}\n`;
        };
        const setText = (text: string): void => {
            cm.setValue(`${text.trimEnd()}\n`);
        };
        const onChangesHandler = () => { callbacks.current.onChanges(); };
        cm.on('changes', onChangesHandler);
        // Upstream swaps the save command depending on validity; the page
        // decides inside onSave instead.
        CodeMirror.commands.save = () => { callbacks.current.onSave(); };

        setHandle({ cm, host: element, getText, setText });
        return () => { cm.off('changes', onChangesHandler); };
    }, [ rules ]);

    return [ host, handle ];
}

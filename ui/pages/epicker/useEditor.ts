import { useEffect, useRef } from 'react';

// The filter field. CodeMirror stays a bespoke widget here, as on every other
// ported page: it is the only thing that gives the filter syntax highlighting
// and the uBO auto-complete, and Material has no equivalent. Everything around
// it is a Material component.

export interface EditorHandle {
    getText(): string;
    setText(text: string): void;
}

export function useEditor(
    onChanged: (text: string) => void,
    register: (handle: EditorHandle) => void,
): React.RefObject<HTMLDivElement | null> {
    const host = useRef<HTMLDivElement>(null);
    const callbacks = useRef({ onChanged, register });
    callbacks.current = { onChanged, register };

    useEffect(() => {
        if ( host.current === null ) { return; }
        const cm = new CodeMirror(host.current, {
            autoCloseBrackets: true,
            autofocus: true,
            extraKeys: { 'Ctrl-Space': 'autocomplete' },
            lineWrapping: true,
            matchBrackets: true,
            maxScanLines: 1,
        });

        // Writing the value back must not look like the user typing, or every
        // programmatic set would bounce through onChanged and re-post to the
        // page.
        let muted = false;
        const handle: EditorHandle = {
            getText: ( ) => cm.getValue(),
            setText(text) {
                muted = true;
                cm.setValue(text);
                cm.clearHistory();
                muted = false;
            },
        };
        callbacks.current.register(handle);

        cm.on('changes', ( ) => {
            if ( muted ) { return; }
            callbacks.current.onChanged(cm.getValue());
        });

        void vAPI.messaging.send('dashboard', { what: 'getAutoCompleteDetails' })
            .then(hints => {
                if ( hints instanceof Object === false ) { return; }
                cm.setOption('uboHints', hints);
            })
            .catch(( ) => { /* hints are a convenience, not a requirement */ });

        return ( ) => { cm.setOption('uboHints', undefined); };
    }, []);

    return host;
}

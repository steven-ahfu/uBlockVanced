import { useEffect, useRef, useState } from 'react';
import { t } from '../../shared/i18n';

// Owns the CodeMirror MergeView (permanent rules on the left, temporary
// rules in the editable right pane). Same options as upstream dyna-rules.js;
// CodeMirror is a bespoke widget, not a Material component.

export interface MergeHandle {
    mv: CMMergeView;
    orig: CMPane;
    edit: CMPane;
}

export function useMergeView(): [ React.RefObject<HTMLDivElement | null>, MergeHandle | null ] {
    const host = useRef<HTMLDivElement>(null);
    const [ handle, setHandle ] = useState<MergeHandle | null>(null);

    useEffect(() => {
        if ( host.current === null ) { return; }
        const MergeView = (CodeMirror as unknown as { MergeView: CMMergeViewCtor }).MergeView;
        const mv = new MergeView(host.current, {
            allowEditingOriginals: true,
            connect: 'align',
            inputStyle: 'contenteditable',
            lineNumbers: true,
            lineWrapping: false,
            mode: 'ubo-dynamic-filtering',
            origLeft: '',
            revertButtons: true,
            value: '',
        });
        const edit = mv.editor();
        const orig = mv.leftOriginal();
        edit.setOption('styleActiveLine', true);
        edit.setOption('lineNumbers', false);
        orig.setOption('readOnly', 'nocursor');
        uBlockDashboard.patchCodeMirrorEditor(edit);

        // CodeMirror hard-codes "Push to left/right" titles on the arrows;
        // rewrite them into localized data-tip tooltips whenever they appear.
        const commitStr = t('rulesCommit');
        const revertStr = t('rulesRevert');
        const gap = host.current.querySelector('.CodeMirror-merge-copybuttons-left');
        const lock = host.current.querySelector('.CodeMirror-merge-scrolllock');
        if ( lock !== null ) {
            lock.setAttribute('data-tip', t('genericMergeViewScrollLock'));
            lock.setAttribute('aria-label', t('genericMergeViewScrollLock'));
            lock.removeAttribute('title');
        }
        const translate = () => {
            if ( gap === null ) { return; }
            for ( const elem of gap.querySelectorAll('.CodeMirror-merge-copy-reverse[title]') ) {
                elem.setAttribute('data-tip', commitStr);
                elem.setAttribute('aria-label', commitStr);
                elem.removeAttribute('title');
            }
            for ( const elem of gap.querySelectorAll('.CodeMirror-merge-copy[title]') ) {
                elem.setAttribute('data-tip', revertStr);
                elem.setAttribute('aria-label', revertStr);
                elem.removeAttribute('title');
            }
        };
        const observer = new MutationObserver(translate);
        if ( gap !== null ) {
            observer.observe(gap, { attributes: true, attributeFilter: [ 'title' ], subtree: true, childList: true });
        }

        setHandle({ mv, orig, edit });
        return () => { observer.disconnect(); };
    }, []);

    return [ host, handle ];
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from './components/Dialog';
import { Tooltips } from '../../shared/Tooltip';
import { usePicker } from './usePicker';

// The picker is two things stacked on the page: the sea, an SVG that dims
// everything except the element under the cursor, and the dialog that floats
// over it. The sea is not a component and never could be -- it is one path
// with an even-odd fill rule, cut out by the page-side picker.

function useDrag(): [ React.CSSProperties, (ev: React.PointerEvent) => void ] {
    const [ pos, setPos ] = useState<{ right: number; bottom: number } | null>(null);
    const origin = useRef({ x: 0, y: 0, right: 0, bottom: 0 });

    const onGrab = useCallback((ev: React.PointerEvent) => {
        const aside = (ev.currentTarget as HTMLElement).closest('aside');
        if ( aside === null ) { return; }
        const rect = aside.getBoundingClientRect();
        origin.current = {
            x: ev.clientX,
            y: ev.clientY,
            right: self.innerWidth - rect.right,
            bottom: self.innerHeight - rect.bottom,
        };
        const onMove = (move: PointerEvent) => {
            // The dialog is anchored bottom-right, so dragging right or down
            // shrinks the offsets rather than growing them.
            setPos({
                right: Math.max(2, origin.current.right - (move.clientX - origin.current.x)),
                bottom: Math.max(2, origin.current.bottom - (move.clientY - origin.current.y)),
            });
        };
        const onUp = ( ) => {
            self.removeEventListener('pointermove', onMove);
            self.removeEventListener('pointerup', onUp);
        };
        self.addEventListener('pointermove', onMove);
        self.addEventListener('pointerup', onUp);
        ev.preventDefault();
        ev.stopPropagation();
    }, []);

    const style: React.CSSProperties = pos === null
        ? { right: 2, bottom: 2 }
        : { right: pos.right, bottom: pos.bottom };
    return [ style, onGrab ];
}

export function App() {
    const [ state, actions ] = usePicker();
    const [ dialogStyle, onGrab ] = useDrag();
    const islandsRef = useRef<SVGPathElement>(null);

    // Upstream kept the dialog out of the way of the very first paint.
    useEffect(() => {
        document.documentElement.classList.add('ubv-epicker');
    }, []);

    const onSvgClick = useCallback((ev: React.MouseEvent) => {
        actions.onSvgClick({
            clientX: ev.clientX,
            clientY: ev.clientY,
            ctrlKey: ev.ctrlKey,
            onIslands: ev.target === islandsRef.current,
        });
    }, [ actions ]);

    return (
        <>
            <svg id="sea" onClick={onSvgClick}>
                <path d={state.ocean} />
                <path ref={islandsRef} d={state.islands} />
            </svg>
            {state.zap ? null : (
                <div className="ubv-dialog-layer" style={dialogStyle}>
                    <Dialog state={state} actions={actions} onGrab={onGrab} />
                </div>
            )}
            <Tooltips />
        </>
    );
}

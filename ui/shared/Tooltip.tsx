import { PlainTooltip } from 'material-expressive-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './tooltip.css';

// Material 3 plain tooltips for every element carrying a `data-tip`
// attribute. One instance is mounted per page; it listens on the document,
// so it works for Material custom elements too (the retargeted event
// reaches the host element, which is where `data-tip` lives).
//
// Behaviour follows the M3 spec: opens on hover/focus after a short delay,
// fades in/out, sits below the anchor (above when there is no room), and
// closes on pointer down, Escape, or scroll.

const SHOW_DELAY = 350;
const HIDE_DELAY = 80;
const GAP = 8;
const MARGIN = 6;

interface TipState {
    text: string;
    anchor: Element;
}

export function Tooltips() {
    const [ tip, setTip ] = useState<TipState | null>(null);
    const [ visible, setVisible ] = useState(false);
    const [ pos, setPos ] = useState({ x: 0, y: 0 });
    const box = useRef<HTMLDivElement>(null);
    const showTimer = useRef(0);
    const hideTimer = useRef(0);

    useEffect(() => {
        const clearTimers = () => {
            if ( showTimer.current !== 0 ) { self.clearTimeout(showTimer.current); showTimer.current = 0; }
            if ( hideTimer.current !== 0 ) { self.clearTimeout(hideTimer.current); hideTimer.current = 0; }
        };
        const hide = (immediate = false) => {
            clearTimers();
            setVisible(false);
            if ( immediate ) { setTip(null); return; }
            hideTimer.current = self.setTimeout(() => { setTip(null); }, 160);
        };
        const anchorOf = (target: EventTarget | null): Element | null => {
            if ( target instanceof Element === false ) { return null; }
            const anchor = target.closest('[data-tip]');
            if ( anchor === null ) { return null; }
            const text = anchor.getAttribute('data-tip') ?? '';
            return text === '' ? null : anchor;
        };
        const show = (anchor: Element) => {
            clearTimers();
            showTimer.current = self.setTimeout(() => {
                showTimer.current = 0;
                setTip({ text: anchor.getAttribute('data-tip') ?? '', anchor });
                setVisible(true);
            }, SHOW_DELAY);
        };
        const onOver = (ev: Event) => {
            const anchor = anchorOf(ev.target);
            if ( anchor === null ) { return; }
            show(anchor);
        };
        const onOut = (ev: MouseEvent) => {
            const anchor = anchorOf(ev.target);
            if ( anchor === null ) { return; }
            const to = ev.relatedTarget;
            if ( to instanceof Node && anchor.contains(to) ) { return; }
            clearTimers();
            hideTimer.current = self.setTimeout(() => { hide(); }, HIDE_DELAY);
        };
        const onFocusIn = (ev: FocusEvent) => {
            const anchor = anchorOf(ev.target);
            if ( anchor === null ) { return; }
            if ( anchor.matches(':focus-visible') === false ) { return; }
            show(anchor);
        };
        const onFocusOut = () => { hide(); };
        const onDismiss = () => { hide(true); };
        const onKey = (ev: KeyboardEvent) => { if ( ev.key === 'Escape' ) { hide(true); } };
        document.addEventListener('mouseover', onOver, true);
        document.addEventListener('mouseout', onOut, true);
        document.addEventListener('focusin', onFocusIn, true);
        document.addEventListener('focusout', onFocusOut, true);
        document.addEventListener('mousedown', onDismiss, true);
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('scroll', onDismiss, true);
        self.addEventListener('blur', onDismiss);
        return () => {
            clearTimers();
            document.removeEventListener('mouseover', onOver, true);
            document.removeEventListener('mouseout', onOut, true);
            document.removeEventListener('focusin', onFocusIn, true);
            document.removeEventListener('focusout', onFocusOut, true);
            document.removeEventListener('mousedown', onDismiss, true);
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('scroll', onDismiss, true);
            self.removeEventListener('blur', onDismiss);
        };
    }, []);

    // Position once the tooltip has been laid out (needs its own size).
    useEffect(() => {
        if ( tip === null || box.current === null ) { return; }
        const a = tip.anchor.getBoundingClientRect();
        const b = box.current.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        let x = a.left + a.width / 2 - b.width / 2;
        x = Math.max(MARGIN, Math.min(x, vw - b.width - MARGIN));
        let y = a.bottom + GAP;
        if ( y + b.height > vh - MARGIN ) { y = a.top - GAP - b.height; }
        if ( y < MARGIN ) { y = MARGIN; }
        setPos({ x, y });
    }, [ tip ]);

    if ( tip === null ) { return null; }
    return createPortal(
        <div
            ref={box}
            className={'ubv-tooltip' + (visible ? ' show' : '')}
            style={{ left: pos.x, top: pos.y }}
            aria-hidden="true"
        >
            <PlainTooltip role="presentation">{tip.text}</PlainTooltip>
        </div>,
        document.body,
    );
}

import { Menu, MenuDivider, MenuItem } from 'material-expressive-react/menu';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { icons } from '../../../shared/icons';
import { t, tf } from '../../../shared/i18n';
import type { FilterExpressions as Filters } from '../types';

interface Props { filters: Filters; onChange(next: Filters): void; tooltips: boolean }

type Key = keyof Filters;
const KEYS: Key[] = [ 'notA', 'blocked', 'allowed', 'notB', 'script', 'frame' ];

const isKey = (v: string): v is Key => (KEYS as string[]).includes(v);

// "Showing only rows with blocked requests; hiding rows with 3rd-party
// scripts or frames." One sentence for the whole filter state.
export function filterSentence(f: Filters): string {
    const clauses: string[] = [];
    const a = [ f.blocked ? t('popupFilterBlockedRequests') : '', f.allowed ? t('popupFilterAllowedRequests') : '' ].filter(Boolean);
    if ( a.length !== 0 ) {
        clauses.push(tf(f.notA ? 'popupFilterHiding' : 'popupFilterShowing', { what: a.join(t('popupFilterOr')) }));
    }
    const b = [ f.script ? t('popupFilter3pScripts') : '', f.frame ? t('popupFilter3pFrames') : '' ].filter(Boolean);
    if ( b.length !== 0 ) {
        clauses.push(tf(f.notB ? 'popupFilterHiding' : 'popupFilterShowing', { what: b.join(t('popupFilterOr')) }));
    }
    if ( clauses.length === 0 ) { return t('popupFilterSentenceAll'); }
    return clauses.join(t('popupFilterClauseSeparator')) + '.';
}

// The firewall row filters: an icon button opens an M3E multi-select menu
// (blocked / allowed, 3rd-party scripts / frames, each group invertible);
// the resulting state is read back as one sentence next to the button.
export function FilterExpressions({ filters, onChange, tooltips }: Props) {
    const [ open, setOpen ] = useState(false);
    const host = useRef<HTMLDivElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const menuId = useId();
    // The firewall pane scrolls and clips, so the menu is portalled to
    // <body> and fixed under the button.
    const [ anchor, setAnchor ] = useState({ top: 0, left: 0 });

    // Close on outside click or Escape.
    useEffect(() => {
        if ( open === false ) { return; }
        const onDown = (ev: MouseEvent) => {
            if ( ev.target instanceof Node ) {
                if ( host.current?.contains(ev.target) || menu.current?.contains(ev.target) ) { return; }
            }
            setOpen(false);
        };
        const onKey = (ev: KeyboardEvent) => { if ( ev.key === 'Escape' ) { setOpen(false); } };
        document.addEventListener('mousedown', onDown, true);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onDown, true);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [ open ]);

    // Anchor under the button; follow scroll and resize while open.
    useLayoutEffect(() => {
        if ( open === false ) { return; }
        const place = () => {
            const r = host.current?.querySelector('.ubv-filter-button')?.getBoundingClientRect();
            if ( r ) { setAnchor({ top: r.bottom + 4, left: r.left }); }
        };
        place();
        self.addEventListener('resize', place, { passive: true });
        document.addEventListener('scroll', place, { capture: true, passive: true });
        return () => {
            self.removeEventListener('resize', place);
            document.removeEventListener('scroll', place, { capture: true });
        };
    }, [ open ]);

    const selected = KEYS.filter(k => filters[k]);
    const onValueChange = (value: string | string[]) => {
        const set = new Set((Array.isArray(value) ? value : [ value ]).filter(isKey));
        const next: Filters = { notA: false, blocked: false, allowed: false, notB: false, script: false, frame: false };
        for ( const k of set ) { next[k] = true; }
        // blocked and allowed are mutually exclusive, as upstream: the one
        // just picked wins.
        if ( next.blocked && next.allowed ) {
            if ( filters.blocked ) { next.blocked = false; } else { next.allowed = false; }
        }
        // An inversion without a subject means nothing.
        if ( next.blocked === false && next.allowed === false ) { next.notA = false; }
        if ( next.script === false && next.frame === false ) { next.notB = false; }
        onChange(next);
    };

    const check = (key: Key) => (filters[key] ? <Icon svg={icons.check} /> : null);
    const item = (key: Key, label: string, tip: string, disabled = false) => (
        <MenuItem value={key} label={label} showSelectedIcon={false} trailingIcon={check(key)}
            disabled={disabled} aria-label={tip} data-tip={tooltips ? tip : undefined} />
    );
    const sentence = filterSentence(filters);
    const active = selected.length !== 0;

    return (
        <div ref={host} className="ubv-filter" role="group" aria-label={t('popupTipFirewallFilters')}>
            <IconButton
                variant={active ? 'tonal' : 'standard'}
                className="ubv-filter-button"
                aria-label={t('popupTipFirewallFilters')}
                aria-haspopup="menu"
                aria-expanded={open ? 'true' : 'false'}
                aria-controls={menuId}
                data-tip={tooltips && open === false ? t('popupTipFirewallFilters') : undefined}
                onClick={() => setOpen(v => !v)}
            >
                <Icon svg={icons.filter} />
            </IconButton>
            <span className="ubv-filter-sentence" aria-live="polite">{sentence}</span>
            {open ? createPortal(
                <Menu ref={menu} id={menuId} className="ubv-m3 ubv-filter-menu" selectType="multi" size="xsmall"
                    style={{ top: anchor.top, left: anchor.left }}
                    value={selected} onValueChange={onValueChange} role="menu">
                    <span className="ubv-filter-group">{t('popupFilterGroupRequests')}</span>
                    {item('blocked', t('popupFilterBlockedRequests'), t('popupTipFilterBlocked'))}
                    {item('allowed', t('popupFilterAllowedRequests'), t('popupTipFilterAllowed'))}
                    {item('notA', t('popupFilterInvert'), t('popupTipFilterNot'), !(filters.blocked || filters.allowed))}
                    <MenuDivider />
                    <span className="ubv-filter-group">{t('popupFilterGroup3p')}</span>
                    {item('script', t('popupFilter3pScripts'), t('popupTipFilterScript'))}
                    {item('frame', t('popupFilter3pFrames'), t('popupTipFilterFrame'))}
                    {item('notB', t('popupFilterInvert'), t('popupTipFilterNot'), !(filters.script || filters.frame))}
                </Menu>,
                document.body,
            ) : null}
        </div>
    );
}

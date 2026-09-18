import { OutlinedSegmentedButton, OutlinedSegmentedButtonSet } from 'material-expressive-react';
import { useRef, useState } from 'react';
import type { CSSProperties, FocusEvent, MouseEvent, ReactNode } from 'react';
import { FilterExpressions } from './FilterExpressions';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { ToggleButton } from 'material-expressive-react/button';
import { cellRuleClass, cellRuleName, countLevel, firewallFilterClasses, gtz } from '../model';
import type { CellRuleName, HostRow } from '../model';
import { popupIcons } from '../icons';
import { t, tf } from '../../../shared/i18n';
import type { PopupActions, PopupState } from '../usePopup';
import type { RuleAction, RuleScope } from '../types';

interface Props { state: PopupState; actions: PopupActions }

interface HoverCell { des: string; type: string; scope: RuleScope }

interface CellOpts {
    scope: RuleScope;
    des: string;
    type: string;
    /** What the row is about, for the cell's accessible name. */
    what: string;
    counts?: { allowed?: number; blocked?: number };
    tip?: string;
    slotKey?: string;
}

const builtinTypes: Array<[ string, string ]> = [
    [ 'image', 'popupImageRulePrompt' ],
    [ '3p', 'popup3pAnyRulePrompt' ],
    [ 'inline-script', 'popupInlineScriptRulePrompt' ],
    [ '1p-script', 'popup1pScriptRulePrompt' ],
    [ '3p-script', 'popup3pScriptRulePrompt' ],
    [ '3p-frame', 'popup3pFrameRulePrompt' ],
];

const scopeKeys: Record<RuleScope, string> = {
    '/': 'popupFirewallScopeGlobal',
    '.': 'popupFirewallScopeLocal',
};

const ruleKeys: Record<CellRuleName, string> = {
    none: 'popupFirewallRuleNone',
    allow: 'popupFirewallRuleAllow',
    block: 'popupFirewallRuleBlock',
    noop: 'popupFirewallRuleNoop',
};

interface Hotspot { value: string; action: RuleAction; icon: string; key: string; godOnly: boolean }

// The three hotspots, in the order upstream drew them inside #actionSelector.
// `allow` stays god-mode only, exactly as popup-fenix.css hides #dynaAllow.
const hotspots: Hotspot[] = [
    { value: 'allow', action: 2, icon: popupIcons.allow, key: 'popupFirewallSetAllow', godOnly: true },
    { value: 'noop', action: 3, icon: popupIcons.noop, key: 'popupFirewallSetNoop', godOnly: false },
    { value: 'block', action: 1, icon: popupIcons.block, key: 'popupFirewallSetBlock', godOnly: false },
];

// Geometry for a matrix cell. ToggleButton writes height, padding, radius and
// colour inline (colours as var(--md-sys-color-secondary*) references), so the
// only way to size it from tokens is to hand the wrapper the tokens as its
// inline values — ui/shared/metrics.ts does the same for the ribbon tiles.
// popup.css remaps the colour tokens per rule class on the host.
const cellStyle = (own: boolean, interactive: boolean): CSSProperties => ({
    borderColor: own ? 'var(--ubv-selected-outline)' : 'transparent',
    borderRadius: 'var(--ubv-radius-chip)',
    cursor: interactive ? 'pointer' : 'default',
    fontSize: '11px',
    fontWeight: 600,
    height: 'var(--ubv-fw-row)',
    justifyContent: 'space-between',
    letterSpacing: '0.02em',
    lineHeight: '14px',
    minWidth: 0,
    paddingInline: '7px',
    transition: 'var(--ubv-hover-transition)',
    width: '100%',
});

// The hotspot triplet floats over the hovered cell, inset far enough to leave
// the cell's own colour showing as a ring around it (~28px tall in a 40px row).
const hotspotStyle: CSSProperties = {
    background: 'var(--md-sys-color-surface-container-highest)',
    borderColor: 'var(--md-sys-color-outline-variant)',
    borderRadius: 'var(--ubv-radius-chip)',
    boxShadow: 'var(--el-2)',
    inset: '6px 2px',
    position: 'absolute',
    zIndex: 2,
};

// The dynamic filtering matrix. Every control is a Material component: each
// cell is a ToggleButton (tonal, square) whose colours popup.css remaps per
// rule class, the hover hotspots are an OutlinedSegmentedButtonSet, and the
// row expanders are IconButtons. The upstream ids/row classes stay so the
// filter classes (showBlocked / hide3pFrame / ...) and the
// expanded / isSubdomain rules in popup-fenix.css keep hiding rows.
export function Firewall({ state, actions }: Props) {
    const { data, expandExceptions, expanded, filters, firewall, godMode } = state;
    const [ hover, setHover ] = useState<HoverCell | null>(null);
    // The segmented set hands its handler a value, not an event, so the
    // Ctrl/Cmd "make it permanent" modifier is captured on the way down.
    const persist = useRef(false);
    const advanced = data?.advancedUserEnabled === true;
    const noTip = data?.tooltipsDisabled === true;

    const classes = [ 'ubv-firewall' ];
    if ( expanded ) { classes.push('expanded'); }
    if ( firewall && (firewall.a3pScript !== 0 || firewall.b3pScript !== 0) ) { classes.push('has3pScript'); }
    if ( firewall && (firewall.a3pFrame !== 0 || firewall.b3pFrame !== 0) ) { classes.push('has3pFrame'); }
    classes.push(...firewallFilterClasses(filters));

    const isRowExpanded = (row: HostRow): boolean =>
        expanded !== expandExceptions.has(row.domain);

    // Clicking a cell that carries an own rule clears it, as upstream.
    const onCellClick = (ev: MouseEvent, scope: RuleScope, des: string, type: string, own: boolean) => {
        if ( advanced === false || data === null || own === false ) { return; }
        actions.setRule(scope, des, type, 0, ev.ctrlKey || ev.metaKey);
    };

    const onHotspot = (value: string, scope: RuleScope, des: string, type: string) => {
        const spot = hotspots.find(h => h.value === value);
        if ( spot === undefined ) { return; }
        actions.setRule(scope, des, type, spot.action, persist.current);
        persist.current = false;
        setHover(null);
    };

    // Focus moving between the cell and its hotspots stays inside the slot.
    const onSlotBlur = (ev: FocusEvent<HTMLDivElement>) => {
        if ( ev.currentTarget.contains(ev.relatedTarget) ) { return; }
        setHover(null);
    };

    const cell = ({ scope, des, type, what, counts, tip, slotKey }: CellOpts): ReactNode => {
        if ( data === null ) { return null; }
        const cls = cellRuleClass(data, scope, des, type);
        const own = cls.includes('ownRule');
        const rule = cellRuleName(cls);
        const hovered = advanced && own === false && hover !== null &&
            hover.des === des && hover.type === type && hover.scope === scope;
        const ruleText = own || rule === 'none'
            ? t(ruleKeys[rule])
            : tf('popupFirewallRuleInherited', { rule: t(ruleKeys[rule]) });
        const subs = { scope: t(scopeKeys[scope]), what, rule: ruleText };
        const label = counts !== undefined && (gtz(counts.allowed) || gtz(counts.blocked))
            ? tf('popupFirewallCellWithCounts', {
                ...subs, allowed: counts.allowed ?? 0, blocked: counts.blocked ?? 0,
            })
            : tf('popupFirewallCell', subs);
        const enter = advanced ? () => setHover({ des, type, scope }) : undefined;
        return (
            <div
                key={slotKey ?? scope}
                className={'ubv-fw-slot' + (hovered ? ' hotspot' : '')}
                onMouseEnter={enter}
                onMouseLeave={advanced ? () => setHover(null) : undefined}
                onFocus={enter}
                onBlur={advanced ? onSlotBlur : undefined}
            >
                <ToggleButton
                    className={'ubv-fw-cell' + (cls !== '' ? ' ' + cls : '')}
                    variant="tonal"
                    shape="square"
                    size="small"
                    selected={own}
                    disabled={advanced === false}
                    style={cellStyle(own, advanced)}
                    data-src={scope}
                    data-acount={counts !== undefined ? countLevel(counts.allowed) : undefined}
                    data-bcount={counts !== undefined ? countLevel(counts.blocked) : undefined}
                    data-tip={noTip ? undefined : tip}
                    aria-label={label}
                    onClick={ev => onCellClick(ev, scope, des, type, own)}
                />
                {hovered ? (
                    <OutlinedSegmentedButtonSet
                        className="ubv-fw-actions"
                        size="xsmall"
                        value=""
                        style={hotspotStyle}
                        aria-label={t('popupFirewallActions')}
                        onClickCapture={ev => { persist.current = ev.ctrlKey || ev.metaKey; }}
                        onClick={value => onHotspot(value, scope, des, type)}
                    >
                        {hotspots.filter(h => h.godOnly === false || godMode).map(h => (
                            <OutlinedSegmentedButton key={h.value} value={h.value}
                                icon={<Icon svg={h.icon} label={t(h.key)} />} />
                        ))}
                    </OutlinedSegmentedButtonSet>
                ) : null}
            </div>
        );
    };

    // The label column: an expander (when the row has one) beside plain text.
    const rowLabel = (text: string, lead: ReactNode, extra?: string) => (
        <div className="ubv-fw-label">
            <span className="ubv-fw-lead">{lead}</span>
            <span className="ubv-fw-text">
                {text}
                {extra ? <sub>{extra}</sub> : null}
            </span>
        </div>
    );

    const expander = (opts: {
        open: boolean;
        label: string;
        tip?: string;
        controls?: string;
        onClick: (ev: MouseEvent) => void;
    }) => (
        <IconButton
            className="ubv-fw-expander"
            variant="standard"
            compact
            aria-label={opts.label}
            aria-expanded={opts.open ? 'true' : 'false'}
            aria-controls={opts.controls}
            data-tip={noTip ? undefined : (opts.tip ?? opts.label)}
            onClick={opts.onClick}
        >
            <Icon svg={opts.open ? popupIcons.expanded : popupIcons.collapsed} />
        </IconButton>
    );

    // Shift+Ctrl on the "all" row expander opens the panel in a tab, as upstream.
    const onAnyRuleClick = (ev: MouseEvent) => {
        if ( ev.shiftKey && ev.ctrlKey ) { actions.openInTab(); return; }
        actions.setGlobalExpand(expanded === false);
    };

    const anyPrompt = t('popupAnyRulePrompt');

    return (
        <div id="firewall" className={classes.join(' ')} data-more="e">
            <section className="ubv-filter-section">
                <FilterExpressions filters={filters} tooltips={noTip === false} onChange={next => actions.setFilters(next)} />
            </section>
            <div data-des="*" data-type="*">
                {rowLabel(anyPrompt, expander({
                    open: expanded,
                    controls: 'firewall',
                    label: t(expanded ? 'popupFirewallCollapseAll' : 'popupFirewallExpandAll'),
                    tip: t('popupFirewallExpandAllTip'),
                    onClick: onAnyRuleClick,
                }))}
                {advanced ? cell({ scope: '/', des: '*', type: '*', what: anyPrompt, tip: t('popupTipGlobalRules') }) : null}
                {cell({ scope: '.', des: '*', type: '*', what: anyPrompt, tip: t('popupTipLocalRules') })}
            </div>
            {builtinTypes.map(([ type, key ]) => {
                let counts: { allowed: number; blocked: number } | undefined;
                if ( firewall !== null ) {
                    if ( type === '1p-script' ) { counts = { allowed: firewall.a1pScript, blocked: firewall.b1pScript }; }
                    if ( type === '3p-script' ) { counts = { allowed: firewall.a3pScript, blocked: firewall.b3pScript }; }
                    if ( type === '3p-frame' ) { counts = { allowed: firewall.a3pFrame, blocked: firewall.b3pFrame }; }
                }
                const what = t(key);
                return (
                    <div key={type} data-des="*" data-type={type}>
                        {rowLabel(what, null)}
                        {advanced ? cell({ scope: '/', des: '*', type, what }) : null}
                        {cell({ scope: '.', des: '*', type, what, counts })}
                    </div>
                );
            })}
            {firewall?.rows.map(row => {
                const rowClasses: string[] = [];
                if ( row.isCname ) { rowClasses.push('isCname'); }
                if ( row.isRootContext ) { rowClasses.push('isRootContext'); }
                if ( row.is3p ) { rowClasses.push('is3p'); }
                if ( row.isDomain ) { rowClasses.push('isDomain'); }
                if ( row.hasSubdomains ) { rowClasses.push('hasSubdomains'); }
                if ( row.isSubdomain ) { rowClasses.push('isSubdomain'); }
                if ( gtz(row.counts.allowed.any) ) { rowClasses.push('allowed'); }
                if ( gtz(row.counts.blocked.any) ) { rowClasses.push('blocked'); }
                if ( gtz(row.totals?.allowed.any) ) { rowClasses.push('totalAllowed'); }
                if ( gtz(row.totals?.blocked.any) ) { rowClasses.push('totalBlocked'); }
                if ( row.hasScript ) { rowClasses.push('hasScript'); }
                if ( row.hasFrame ) { rowClasses.push('hasFrame'); }
                if ( expandExceptions.has(row.domain) ) { rowClasses.push('expandException'); }
                const expandable = row.isDomain && row.hasSubdomains;
                const open = isRowExpanded(row);
                // A collapsed domain row reports its subtree's totals, an
                // expanded one only its own, exactly as the upstream
                // nth-of-type rules picked one of the two "." cells.
                const totals = row.isDomain && open === false;
                return (
                    <div key={row.des} data-des={row.des} data-type="*" className={rowClasses.join(' ') || undefined}>
                        {rowLabel(row.prettyName, expandable ? expander({
                            open,
                            label: tf(open ? 'popupFirewallCollapseRow' : 'popupFirewallExpandRow', { what: row.prettyName }),
                            onClick: () => actions.setSpecificExpand(row.des, expandExceptions.has(row.des) === false),
                        }) : null, row.extra)}
                        {advanced ? cell({ scope: '/', des: row.des, type: '*', what: row.prettyName }) : null}
                        {cell({
                            scope: '.', des: row.des, type: '*', what: row.prettyName,
                            slotKey: totals ? 'totals' : 'own',
                            counts: totals
                                ? { allowed: row.totals?.allowed.any, blocked: row.totals?.blocked.any }
                                : { allowed: row.counts.allowed.any, blocked: row.counts.blocked.any },
                        })}
                    </div>
                );
            })}
        </div>
    );
}

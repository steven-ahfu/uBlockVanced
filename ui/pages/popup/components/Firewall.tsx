import { useState } from 'react';
import type { MouseEvent } from 'react';
import { FilterExpressions } from './FilterExpressions';
import { Icon } from '../../../shared/Icon';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import { cellRuleClass, countLevel, firewallFilterClasses, gtz } from '../model';
import type { HostRow } from '../model';
import type { PopupActions, PopupState } from '../usePopup';
import type { RuleAction, RuleScope } from '../types';

interface Props { state: PopupState; actions: PopupActions }

interface HoverCell { des: string; type: string; scope: RuleScope }

const builtinTypes: Array<[ string, string ]> = [
    [ 'image', 'popupImageRulePrompt' ],
    [ '3p', 'popup3pAnyRulePrompt' ],
    [ 'inline-script', 'popupInlineScriptRulePrompt' ],
    [ '1p-script', 'popup1pScriptRulePrompt' ],
    [ '3p-script', 'popup3pScriptRulePrompt' ],
    [ '3p-frame', 'popup3pFrameRulePrompt' ],
];

// The dynamic filtering matrix. This is a bespoke uBO widget, not a Material
// component: it keeps the upstream ids/classes so popup-fenix.css draws it
// and every upstream rule/count/hover behaviour is reproduced.
export function Firewall({ state, actions }: Props) {
    const { data, firewall, expanded, expandExceptions, filters } = state;
    const [ hover, setHover ] = useState<HoverCell | null>(null);
    const advanced = data?.advancedUserEnabled === true;

    const classes = [ 'ubv-firewall' ];
    if ( expanded ) { classes.push('expanded'); }
    if ( firewall && (firewall.a3pScript !== 0 || firewall.b3pScript !== 0) ) { classes.push('has3pScript'); }
    if ( firewall && (firewall.a3pFrame !== 0 || firewall.b3pFrame !== 0) ) { classes.push('has3pFrame'); }
    classes.push(...firewallFilterClasses(filters));

    const isRowExpanded = (row: HostRow): boolean =>
        expanded !== expandExceptions.has(row.domain);

    const onCellClick = (ev: MouseEvent, scope: RuleScope, des: string, type: string, own: boolean) => {
        if ( !advanced || data === null ) { return; }
        if ( (ev.target as HTMLElement).closest('#actionSelector') !== null ) { return; }
        if ( !own ) { return; }
        actions.setRule(scope, des, type, 0, ev.ctrlKey || ev.metaKey);
    };

    const onHotspot = (ev: MouseEvent, action: RuleAction, scope: RuleScope, des: string, type: string) => {
        ev.stopPropagation();
        actions.setRule(scope, des, type, action, ev.ctrlKey || ev.metaKey);
        setHover(null);
    };

    const cell = (scope: RuleScope, des: string, type: string, counts?: { allowed?: number; blocked?: number }, key?: string) => {
        if ( data === null ) { return null; }
        const cls = cellRuleClass(data, scope, des, type);
        const own = cls.includes('ownRule');
        const hovered = advanced && !own && hover !== null &&
            hover.des === des && hover.type === type && hover.scope === scope;
        const props: Record<string, unknown> = {};
        if ( counts !== undefined ) {
            props['data-acount'] = countLevel(counts.allowed);
            props['data-bcount'] = countLevel(counts.blocked);
        }
        return (
            <span
                key={key ?? scope}
                data-src={scope}
                className={cls || undefined}
                onClick={ev => onCellClick(ev, scope, des, type, own)}
                onMouseEnter={advanced ? () => setHover({ des, type, scope }) : undefined}
                onMouseLeave={advanced ? () => setHover(null) : undefined}
                {...props}
            >
                {hovered ? (
                    <span id="actionSelector">
                        <span id="dynaAllow" onClick={ev => onHotspot(ev, 2, scope, des, type)}></span>
                        <span id="dynaNoop" onClick={ev => onHotspot(ev, 3, scope, des, type)}></span>
                        <span id="dynaBlock" onClick={ev => onHotspot(ev, 1, scope, des, type)}></span>
                        <span id="dynaCounts"></span>
                    </span>
                ) : null}
            </span>
        );
    };

    const onAnyRuleClick = (ev: MouseEvent) => {
        if ( ev.shiftKey && ev.ctrlKey ) { actions.openInTab(); return; }
        actions.setGlobalExpand(!expanded);
    };

    return (
        <div id="firewall" className={classes.join(' ')} data-more="e">
            <section>
                <Icon svg={icons.filter} className="ubv-filter-icon" />
                <FilterExpressions filters={filters} onChange={next => actions.setFilters(next)} />
            </section>
            <div data-des="*" data-type="*">
                <span role="button" tabIndex={0} aria-controls="firewall" aria-expanded={expanded ? 'true' : 'false'}
                    onClick={onAnyRuleClick}
                    onKeyDown={ev => { if ( ev.key === 'Enter' || ev.key === ' ' ) { ev.preventDefault(); actions.setGlobalExpand(!expanded); } }}>
                    {t('popupAnyRulePrompt')}
                </span>
                {cell('/', '*', '*')}
                {cell('.', '*', '*')}
            </div>
            {builtinTypes.map(([ type, key ]) => {
                let counts: { allowed: number; blocked: number } | undefined;
                if ( firewall !== null ) {
                    if ( type === '1p-script' ) { counts = { allowed: firewall.a1pScript, blocked: firewall.b1pScript }; }
                    if ( type === '3p-script' ) { counts = { allowed: firewall.a3pScript, blocked: firewall.b3pScript }; }
                    if ( type === '3p-frame' ) { counts = { allowed: firewall.a3pFrame, blocked: firewall.b3pFrame }; }
                }
                return (
                    <div key={type} data-des="*" data-type={type}>
                        <span>{t(key)}</span>
                        {cell('/', '*', type)}
                        {cell('.', '*', type, counts)}
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
                return (
                    <div key={row.des} data-des={row.des} data-type="*" className={rowClasses.join(' ') || undefined}>
                        <span
                            role={expandable ? 'button' : undefined}
                            tabIndex={expandable ? 0 : undefined}
                            aria-expanded={expandable ? (isRowExpanded(row) ? 'true' : 'false') : undefined}
                            onClick={expandable ? () => actions.setSpecificExpand(row.des, !expandExceptions.has(row.des)) : undefined}
                            onKeyDown={expandable ? ev => {
                                if ( ev.key === 'Enter' || ev.key === ' ' ) {
                                    ev.preventDefault();
                                    actions.setSpecificExpand(row.des, !expandExceptions.has(row.des));
                                }
                            } : undefined}
                        >
                            <span><span>{row.prettyName}</span></span>
                            <sub>{row.extra}</sub>
                        </span>
                        {cell('/', row.des, '*')}
                        {cell('.', row.des, '*', { allowed: row.counts.allowed.any, blocked: row.counts.blocked.any }, 'own')}
                        {row.isDomain
                            ? cell('.', row.des, '*', { allowed: row.totals?.allowed.any, blocked: row.totals?.blocked.any }, 'totals')
                            : null}
                    </div>
                );
            })}
        </div>
    );
}

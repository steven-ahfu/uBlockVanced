import { ChipSet, FilterChip } from 'material-expressive-react/chips';
import { t } from '../../../shared/i18n';
import type { FilterExpressions as Filters } from '../types';

interface Props { filters: Filters; onChange(next: Filters): void }

// The firewall row filters as M3 filter chips: [not] blocked allowed / [not] script frame.
export function FilterExpressions({ filters, onChange }: Props) {
    const toggle = (key: keyof Filters) => {
        const next = { ...filters, [key]: !filters[key] };
        // blocked and allowed are mutually exclusive, as upstream.
        if ( key === 'blocked' && next.blocked ) { next.allowed = false; }
        if ( key === 'allowed' && next.allowed ) { next.blocked = false; }
        onChange(next);
    };
    const chip = (key: keyof Filters, label: string, extra = '') => (
        <FilterChip
            className={'ubv-chip' + extra}
            label={label}
            selected={filters[key]}
            aria-pressed={filters[key] ? 'true' : 'false'}
            onClick={() => toggle(key)}
        />
    );
    return (
        <div className="filterExpressions ubv-filters">
            <ChipSet className="ubv-chipset">
                {chip('notA', t('loggerRowFiltererBuiltinNot'), ' ubv-chip-not')}
                {chip('blocked', t('loggerRowFiltererBuiltinBlocked'))}
                {chip('allowed', t('loggerRowFiltererBuiltinAllowed'))}
            </ChipSet>
            <ChipSet className="ubv-chipset">
                {chip('notB', t('loggerRowFiltererBuiltinNot'), ' ubv-chip-not')}
                {chip('script', t('popup3pScriptFilter'))}
                {chip('frame', t('popup3pFrameFilter'))}
            </ChipSet>
        </div>
    );
}

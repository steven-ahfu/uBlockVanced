import { List, ListItem } from '../../../shared/ListItem';
import { Pill, Pills } from '../../../shared/Pill';
import { Section } from './Section';
import { matchesLabel, pluralLabel } from '../model';
import { pageIcons } from '../icons';
import { t } from '../../../shared/i18n';
import type { ProbeState, ProbeStore } from '../useProbe';

interface Props { state: ProbeState; store: ProbeStore }

// The upstream selector badges were coloured by kind; the same three tones.
function toneOf(type: string): 'accent' | 'neutral' | 'warning' {
    if ( type === 'stable' ) { return 'accent'; }
    if ( type === 'pierce' || type === 'robust' ) { return 'warning'; }
    return 'neutral';
}

// Upstream "CSS selectors": one row per generated selector, hovering a row
// highlights it in the inspected page.
export function SelectorCard({ state, store }: Props) {
    const count = state.selectors.length;
    return (
        <Section
            id="selectorSection"
            icon={pageIcons.selectors}
            badge={count > 0 ? String(count) : undefined}
            title={t('epSectionSelectors')}
            subtitle={t('epSectionSelectorsSub')}
            meta={<Pills><Pill id="selectorCount" label={pluralLabel(count, 'selector')} /></Pills>}
        >
            <List id="selectorList" className="ep-selector-list">
                {state.selectors.map((sel, index) => {
                    const selected = state.selectedSelectorIndex === index;
                    return (
                        <ListItem
                            key={sel.type + sel.selector + index}
                            type="button"
                            className={'ep-selector-item' + (selected ? ' selected' : '')}
                            aria-selected={selected}
                            onClick={() => { store.selectSelector(index); }}
                            onMouseEnter={() => { store.hoverSelector(sel); }}
                            onMouseLeave={() => { store.leaveSelector(); }}
                        >
                            <span slot="start" className="ep-row-badge">
                                <Pill tone={toneOf(sel.type)} label={sel.label} />
                            </span>
                            <div slot="headline" className="ep-code">{sel.selector}</div>
                            <div slot="trailing-supporting-text" className="ep-match-count">
                                {matchesLabel(sel.matches)}
                            </div>
                        </ListItem>
                    );
                })}
            </List>
        </Section>
    );
}

// Upstream "Procedural filters": the same rows, with the operator's purpose
// as supporting text.
export function ProceduralCard({ state, store }: Props) {
    const count = state.procedural.length;
    return (
        <Section
            id="proceduralSection"
            icon={pageIcons.procedural}
            badge={count > 0 ? String(count) : undefined}
            title={t('epSectionProcedural')}
            subtitle={t('epSectionProceduralSub')}
            meta={<Pills><Pill id="proceduralCount" label={pluralLabel(count, 'filter')} /></Pills>}
        >
            <List id="proceduralList" className="ep-selector-list">
                {state.procedural.map((pf, index) => {
                    const selected = state.selectedProceduralIndex === index;
                    return (
                        <ListItem
                            key={pf.type + pf.filter + index}
                            type="button"
                            className={'ep-selector-item' + (selected ? ' selected' : '')}
                            aria-selected={selected}
                            onClick={() => { store.selectProcedural(index); }}
                        >
                            <span slot="start" className="ep-row-badge">
                                <Pill tone="warning" label={pf.label} />
                            </span>
                            <div slot="headline" className="ep-code">{pf.filter}</div>
                            <div slot="supporting-text">{pf.description}</div>
                        </ListItem>
                    );
                })}
            </List>
        </Section>
    );
}

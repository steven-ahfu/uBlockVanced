import { FilledButton, OutlinedButton } from 'material-expressive-react/button';
import { OutlinedSelect, SelectOption } from 'material-expressive-react/select';
import { Pill, Pills } from '../../../shared/Pill';
import { RULE_TYPES, compatBadgeOf, filterHintOf, matchCountLabel } from '../model';
import { Icon } from '../../../shared/Icon';
import { Section } from './Section';
import { Textfield } from 'material-expressive-react/textfield';
import { filterActionsDisabled } from '../useProbe';
import { icons } from '../../../shared/icons';
import { pageIcons } from '../icons';
import { t } from '../../../shared/i18n';
import { useEffect } from 'react';
import type { ProbeState, ProbeStore } from '../useProbe';
import type { RuleType } from '../model';

interface Props { state: ProbeState; store: ProbeStore }

const DOMAINS_TIP = 'Comma-separated domains, or * for global';

// Upstream "Filter output": the rule editor, its hints, and the five actions.
export function FilterCard({ state, store }: Props) {
    const disabled = filterActionsDisabled(state);
    const hint = filterHintOf({
        data: state.data,
        filterText: state.filterText,
        isHighlighting: state.isHighlighting,
        selectorCount: state.selectors.length,
    });
    const compat = compatBadgeOf(state.filterText);
    const match = state.matchCount === undefined ? null : matchCountLabel(state.matchCount);

    // The upstream copy handler selected the text when the clipboard refused.
    useEffect(() => {
        store.selectOutput = () => {
            const node = document.getElementById('filterOutput') as (HTMLElement & { select?: () => void }) | null;
            node?.select?.();
        };
        return () => { store.selectOutput = null; };
    }, [ store ]);

    return (
        <Section
            id="filterSection"
            className={'ep-filter-section ep-mode-' + hint.mode}
            icon={icons.filter}
            title={t('epSectionFilter')}
            subtitle={t('epSectionFilterSub')}
            meta={match !== null ? (
                <Pills>
                    <Pill
                        id="filterMatchCount"
                        tone={match.state === 'error' ? 'error' : match.state === 'match' ? 'accent' : 'neutral'}
                        label={match.text}
                    />
                </Pills>
            ) : undefined}
        >
            <Textfield
                id="filterOutput"
                className="ubv-field ep-output"
                variant="outlined"
                type="textarea"
                rows={3}
                spellCheck={false}
                placeholder={t('epFilterPlaceholder')}
                aria-label={t('epSectionFilter')}
                value={state.filterText}
                onInput={ev => { store.setFilterText((ev.target as HTMLInputElement).value); }}
            />

            <div className="ep-hint">
                <Pills>
                    <Pill id="filterHintBadge" tone={hint.mode === 'idle' ? 'neutral' : 'accent'} label={hint.badge} />
                    {compat.label !== '' ? (
                        <Pill
                            id="filterCompatBadge"
                            tone={compat.level === 'narrow' ? 'warning' : 'neutral'}
                            label={compat.label}
                            data-tip={compat.title}
                        />
                    ) : null}
                </Pills>
                <p className="ubv-muted" id="filterHintText">{hint.text}</p>
            </div>

            <div className="ep-fields">
                <Textfield
                    id="filterDomains"
                    className="ubv-field"
                    variant="outlined"
                    type="text"
                    spellCheck={false}
                    label={t('epLabelDomains')}
                    placeholder="example.com"
                    data-tip={DOMAINS_TIP}
                    value={state.domains}
                    onInput={ev => { store.setDomains((ev.target as HTMLInputElement).value); }}
                />
                <OutlinedSelect
                    id="filterType"
                    className="ubv-select"
                    label={t('epLabelRuleType')}
                    value={state.ruleType}
                    onChange={ev => { store.setRuleType((ev.target as HTMLSelectElement).value as RuleType); }}
                >
                    {RULE_TYPES.map(option => (
                        <SelectOption key={option.value} value={option.value} selected={state.ruleType === option.value}>
                            <div slot="headline">{t(option.key)}</div>
                        </SelectOption>
                    ))}
                </OutlinedSelect>
                {state.ruleType === '##-style' ? (
                    <Textfield
                        id="styleValue"
                        className="ubv-field ep-style-field"
                        variant="outlined"
                        type="text"
                        spellCheck={false}
                        label={t('epLabelCss')}
                        placeholder="e.g. opacity: 0 !important"
                        value={state.styleValue}
                        onInput={ev => { store.setStyleValue((ev.target as HTMLInputElement).value); }}
                    />
                ) : null}
            </div>

            <div className="ubv-actions ep-filter-actions">
                <FilledButton
                    id="btnApplyFilter"
                    disabled={disabled.apply || state.busy.apply !== undefined}
                    data-tip={t('epBtnSave')}
                    onClick={() => { void store.applyFilter(); }}
                >
                    <Icon slot="icon" svg={pageIcons.save} />
                    {state.busy.apply ?? t('epBtnSave')}
                </FilledButton>
                <OutlinedButton
                    id="btnCopyFilter"
                    disabled={disabled.copy}
                    data-tip={t('epBtnCopy')}
                    onClick={() => { store.copyFilter(); }}
                >
                    <Icon slot="icon" svg={state.copied ? icons.check : pageIcons.copy} />
                    {state.copied ? 'Copied!' : t('epBtnCopy')}
                </OutlinedButton>
                <OutlinedButton
                    id="btnTestFilter"
                    disabled={disabled.preview || state.busy.preview !== undefined}
                    data-tip={t('epBtnPreview')}
                    onClick={() => { void store.testFilter(); }}
                >
                    <Icon slot="icon" svg={icons.view} />
                    {state.busy.preview ?? t('epBtnPreview')}
                </OutlinedButton>
                <OutlinedButton
                    id="btnTestApply"
                    disabled={state.busy.test !== undefined}
                    data-tip={t('epBtnTest')}
                    onClick={() => { void store.testApply(); }}
                >
                    <Icon slot="icon" svg={pageIcons.test} />
                    {state.busy.test ?? t('epBtnTest')}
                </OutlinedButton>
                <OutlinedButton
                    id="btnRemoveFilter"
                    className="ep-danger"
                    disabled={disabled.clear}
                    data-tip={t('epBtnClearPreview')}
                    onClick={() => { void store.removePreview(); }}
                >
                    <Icon slot="icon" svg={icons.eraser} />
                    {t('epBtnClearPreview')}
                </OutlinedButton>
            </div>
        </Section>
    );
}

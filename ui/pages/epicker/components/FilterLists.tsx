import { List, ListItem } from '../../../shared/ListItem';
import { Slider } from 'material-expressive-react/slider';
import { t } from '../../../shared/i18n';
import type { PickerActions, PickerState } from '../usePicker';

interface Props { state: PickerState; actions: PickerActions }

// The classic answer: which CSS selects this element. Two lists of candidates
// (network, cosmetic) plus the pair of sliders that walk the cosmetic one from
// "the element alone" to "the whole path".

function CandidateGroup({ label, filters, selected, onChoose }: {
    label: string;
    filters: string[];
    selected: number;
    onChoose(index: number): void;
}) {
    if ( filters.length === 0 ) { return null; }
    return (
        <li className="ubv-candidate-group">
            <span className="ubv-candidate-label">{label}</span>
            <List>
                {filters.map((filter, index) => (
                    <ListItem
                        key={`${index}-${filter}`}
                        type="button"
                        lang="en"
                        className={'ubv-candidate' + (index === selected ? ' active' : '')}
                        onClick={( ) => onChoose(index)}
                    >
                        <span slot="headline">{filter}</span>
                    </ListItem>
                ))}
            </List>
        </li>
    );
}

export function ResultsetSliders({ state, actions }: Props) {
    const maxDepth = Math.max(0, state.cosmeticFilters.length - 1);
    if ( state.showModifiers === false || state.mode === 'probe' ) { return null; }
    return (
        <div className="ubv-modifiers">
            <label className="ubv-modifier">
                <span>{t('pickerDepth')}</span>
                <Slider
                    min={0}
                    max={Math.max(maxDepth, 1)}
                    value={state.depth}
                    labeled
                    aria-label={t('pickerDepth')}
                    onInput={ev => actions.setDepth(Number((ev.target as HTMLInputElement).value))}
                />
            </label>
            <label className="ubv-modifier">
                <span>{t('pickerSpecificity')}</span>
                <Slider
                    min={0}
                    max={7}
                    value={state.specificity}
                    labeled
                    aria-label={t('pickerSpecificity')}
                    onInput={ev => actions.setSpecificity(Number((ev.target as HTMLInputElement).value))}
                />
            </label>
        </div>
    );
}

export function CandidateLists({ state, actions }: Props) {
    return (
        <ul className="ubv-candidates" role="tabpanel" aria-labelledby="modeClassic">
            <CandidateGroup
                label={t('pickerNetFilters')}
                filters={state.netFilters}
                selected={state.selectedNet}
                onChoose={actions.chooseNet}
            />
            <CandidateGroup
                label={t('pickerCosmeticFilters')}
                filters={state.cosmeticFilters}
                selected={state.selectedCosmetic}
                onChoose={actions.chooseCosmetic}
            />
        </ul>
    );
}

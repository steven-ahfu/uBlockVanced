import { List, ListItem } from '../../../shared/ListItem';
import { t } from '../../../shared/i18n';
import type { PickerActions, PickerState } from '../usePicker';

interface Props { state: PickerState; actions: PickerActions }

// The other answer: what about this element will still be true next week.
// Each row is the operator that does the work, the filter it produces, and one
// line saying what it selects.
export function ProbeList({ state, actions }: Props) {
    if ( state.probeSuggestions.length === 0 ) {
        return (
            <div className="ubv-probe-empty" role="tabpanel" aria-labelledby="modeProbe">
                {t('pickerProbeNone')}
            </div>
        );
    }
    return (
        <List className="ubv-probe" role="tabpanel" aria-labelledby="modeProbe">
            {state.probeSuggestions.map((suggestion, index) => (
                <ListItem
                    key={suggestion.filter}
                    type="button"
                    className={'ubv-probe-row' + (index === state.selectedProbe ? ' active' : '')}
                    onClick={( ) => actions.chooseProbe(index)}
                >
                    <span slot="overline" className="ubv-probe-label">{suggestion.label}</span>
                    <span slot="headline" lang="en" className="ubv-probe-filter">{suggestion.filter}</span>
                    <span slot="supporting-text" className="ubv-probe-description">
                        {suggestion.description}
                    </span>
                </ListItem>
            ))}
        </List>
    );
}

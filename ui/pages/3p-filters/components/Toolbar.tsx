import { FilledButton, FilledTonalButton } from 'material-expressive-react/button';
import { Textfield } from 'material-expressive-react/textfield';
import { Icon } from '../../../shared/Icon';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import { Toolbar as M3Toolbar } from 'material-expressive-react';
import type { FilterListsActions, FilterListsState } from '../useFilterLists';

interface Props { state: FilterListsState; actions: FilterListsActions }

// Apply / Update and the catalog search, as one Material toolbar.
//
// Apply and Update stay two separate buttons: ConnectedButtonGroup paints
// every segment with one shared `style` (so filled + tonal is impossible),
// and it is a single/multi *selection* group keyed on a value rather than a
// pair of independent actions with their own disabled states.
export function Toolbar({ state, actions }: Props) {
    const applyDisabled = state.dirty === false || state.working;
    const updateDisabled = state.working || state.updating || state.hasObsolete === false;
    return (
        <M3Toolbar variant="Docked" dockPosition="Top" size="Small" className="ubv-toolbar">
            <div className="ubv-actions" role="group" aria-label={t('3pApplyChanges')}>
                <FilledButton
                    id="buttonApply"
                    disabled={applyDisabled}
                    data-tip={t('3pApplyChanges')}
                    onClick={() => { actions.apply(); }}
                >
                    <Icon slot="icon" svg={icons.check} />
                    {t('3pApplyChanges')}
                </FilledButton>
                <FilledTonalButton
                    id="buttonUpdate"
                    className={state.updating ? 'active' : undefined}
                    disabled={updateDisabled}
                    data-tip={t('3pUpdateNow')}
                    onClick={() => { actions.update(); }}
                >
                    <Icon slot="icon" svg={icons.refresh} />
                    {t('3pUpdateNow')}
                </FilledTonalButton>
            </div>
            <Textfield
                className="ubv-field"
                variant="outlined"
                type="search"
                placeholder={t('3pSearchLists')}
                aria-label={t('3pSearchLists')}
                value={state.search}
                hasLeadingIcon
                onInput={ev => { actions.setSearch((ev.target as HTMLInputElement).value); }}
            >
                <Icon slot="leading-icon" svg={icons.search} />
            </Textfield>
        </M3Toolbar>
    );
}

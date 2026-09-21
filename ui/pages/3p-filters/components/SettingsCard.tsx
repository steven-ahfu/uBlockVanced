import { Checkbox } from 'material-expressive-react/checkbox';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { List, ListItem } from '../../../shared/ListItem';
import { icons } from '../../../shared/icons';
import { t, tPlain } from '../../../shared/i18n';
import type { FilterListsActions, FilterListsState } from '../useFilterLists';

interface Props { state: FilterListsState; actions: FilterListsActions }

interface RowProps {
    id: string;
    label: string;
    info?: string;
    checked: boolean;
    onChange(value: boolean): void;
}

// The row itself is the toggle, so the controls in its end slot swallow their
// own clicks instead of letting them reach the row.
const stopRowToggle = (ev: React.MouseEvent): void => { ev.stopPropagation(); };

// One list-loading setting as a Material list row; the info button explains it.
function SettingRow({ id, label, info, checked, onChange }: RowProps) {
    return (
        <ListItem
            className="ubv-setting-row"
            type="button"
            data-setting-name={id}
            onClick={() => { onChange(checked === false); }}
        >
            <div slot="headline" className="ubv-setting-label">{label}</div>
            <div slot="end" className="ubv-setting-end">
                {info ? (
                    <IconButton variant="standard" className="ubv-info"
                        data-tip={info} aria-label={info} onClick={stopRowToggle}>
                        <Icon svg={icons.help} />
                    </IconButton>
                ) : null}
                <Checkbox
                    id={id}
                    checked={checked}
                    aria-label={label}
                    onClick={stopRowToggle}
                    onChange={ev => { onChange((ev.target as HTMLInputElement).checked); }}
                />
            </div>
        </ListItem>
    );
}

// The four list-loading settings. Auto-update and suspend save at once;
// the two cosmetic switches wait for Apply, as upstream.
export function SettingsCard({ state, actions }: Props) {
    return (
        <List className="ubv-settings-list" aria-label={t('3pPageName')}>
            <SettingRow id="autoUpdate" label={t('3pAutoUpdatePrompt1')}
                checked={state.autoUpdate} onChange={actions.setAutoUpdate} />
            <SettingRow id="suspendUntilListsAreLoaded" label={t('3pSuspendUntilListsAreLoaded')}
                checked={state.suspendUntilListsAreLoaded} onChange={actions.setSuspendUntilListsAreLoaded} />
            <SettingRow id="parseCosmeticFilters" label={t('3pParseAllABPHideFiltersPrompt1')}
                info={tPlain('3pParseAllABPHideFiltersInfo')}
                checked={state.parseCosmeticFilters} onChange={actions.setParseCosmeticFilters} />
            <SettingRow id="ignoreGenericCosmeticFilters" label={t('3pIgnoreGenericCosmeticFilters')}
                info={tPlain('3pIgnoreGenericCosmeticFiltersInfo')}
                checked={state.ignoreGenericCosmeticFilters} onChange={actions.setIgnoreGenericCosmeticFilters} />
        </List>
    );
}

// uBlockVanced - the network inspector's toolbar: view density, clean/clear,
// pause, the row filterer (master switch + query + built-in expressions) and
// the export/settings dialogs.

import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { RowFiltererMenu } from './RowFiltererMenu';
import { Textfield } from 'material-expressive-react/textfield';
import { Toolbar } from 'material-expressive-react';
import { loggerIcons } from '../icons';
import type { LoggerActions, LoggerSnapshot } from '../useLogger';
import { t, tOr } from '../../../shared/i18n';
import { useState } from 'react';

interface Props {
    state: LoggerSnapshot;
    actions: LoggerActions;
    onOpenExport(): void;
    onOpenSettings(): void;
}

export function NetToolbar({ state, actions, onOpenExport, onOpenSettings }: Props) {
    const [ pickerOpen, setPickerOpen ] = useState(false);
    const tip = (key: string) => state.tooltips ? t(key) : undefined;

    return (
        <Toolbar
            variant="Docked"
            dockPosition="Top"
            size="Small"
            className="permatoolbar ubv-logger-bar"
            role="toolbar"
            aria-label={t('logFilterPrompt')}
        >
            <div className="ubv-logger-bar-main">
                <IconButton
                    variant={state.vExpanded ? 'tonal' : 'standard'}
                    toggle
                    selected={state.vExpanded}
                    data-tip={tip('loggerInspectorCompactHeightTip')}
                    aria-label={t('loggerInspectorCompactHeightTip')}
                    onClick={() => { actions.toggleVExpanded(); }}
                >
                    <Icon svg={state.vExpanded ? loggerIcons.rows : loggerIcons.vExpand} />
                </IconButton>

                <IconButton
                    id="clean"
                    variant="standard"
                    disabled={state.voidedCount === 0}
                    data-tip={tip('loggerCleanTip')}
                    aria-label={t('loggerCleanTip')}
                    onClick={() => { actions.clean(); }}
                >
                    <Icon svg={loggerIcons.clean} />
                </IconButton>

                <IconButton
                    id="clear"
                    variant="standard"
                    disabled={state.rows.length === 0}
                    data-tip={tip('loggerClearTip')}
                    aria-label={t('loggerClearTip')}
                    onClick={() => { actions.clear(); }}
                >
                    <Icon svg={loggerIcons.clear} />
                </IconButton>

                <IconButton
                    id="pause"
                    variant={state.paused ? 'tonal' : 'standard'}
                    toggle
                    selected={state.paused}
                    data-tip={tip(state.paused ? 'loggerUnpauseTip' : 'loggerPauseTip')}
                    aria-label={t(state.paused ? 'loggerUnpauseTip' : 'loggerPauseTip')}
                    onClick={() => { actions.togglePause(); }}
                >
                    <Icon svg={state.paused ? loggerIcons.play : loggerIcons.pause} />
                </IconButton>

                <div id="filterExprGroup" className="ubv-filtex-group-host">
                    <IconButton
                        id="filterButton"
                        variant={state.masterFilter && state.filterCount !== 0 ? 'tonal' : 'standard'}
                        toggle
                        selected={state.masterFilter}
                        data-tip={tip('loggerRowFiltererButtonTip')}
                        aria-label={t('loggerRowFiltererButtonTip')}
                        onClick={() => { actions.toggleMasterFilter(); }}
                    >
                        <Icon svg={loggerIcons.filter} />
                    </IconButton>

                    <Textfield
                        id="loggerFilterInput"
                        className="ubv-field ubv-logger-filter"
                        variant="outlined"
                        type="search"
                        placeholder={t('logFilterPrompt')}
                        aria-label={t('logFilterPrompt')}
                        value={state.filterInput}
                        hasLeadingIcon
                        onInput={ev => {
                            actions.setFilterInput((ev.target as unknown as { value: string }).value);
                        }}
                    >
                        <Icon slot="leading-icon" svg={loggerIcons.search} />
                    </Textfield>

                    <IconButton
                        id="filterExprButton"
                        variant={pickerOpen ? 'tonal' : 'standard'}
                        toggle
                        selected={pickerOpen}
                        aria-expanded={pickerOpen}
                        aria-haspopup="true"
                        aria-controls="filterExprPicker"
                        data-tip={tip('loggerRowFiltererBuiltinTip')}
                        aria-label={t('loggerRowFiltererBuiltinTip')}
                        onClick={() => { setPickerOpen(open => open === false); }}
                    >
                        <Icon svg={pickerOpen ? loggerIcons.expandLess : loggerIcons.expandMore} />
                    </IconButton>
                </div>
            </div>

            <div className="ubv-logger-bar-end">
                <span className="ubv-logger-count" aria-live="polite">
                    {tOr('loggerUiRowCount', '{{count}} rows').replace(
                        '{{count}}', state.rows.length.toLocaleString()
                    )}
                </span>
                <IconButton
                    id="loggerExport"
                    variant="standard"
                    data-tip={tip('loggerExportTip')}
                    aria-label={t('loggerExportTip')}
                    onClick={onOpenExport}
                >
                    <Icon svg={loggerIcons.export} />
                </IconButton>
                <IconButton
                    id="loggerSettings"
                    variant="standard"
                    data-tip={tip('loggerSettingsTip')}
                    aria-label={t('loggerSettingsTip')}
                    onClick={onOpenSettings}
                >
                    <Icon svg={loggerIcons.settings} />
                </IconButton>
            </div>

            <RowFiltererMenu
                open={pickerOpen}
                state={state.filtex}
                cnameSeen={state.cnameSeen}
                onToggle={filtex => { actions.toggleFiltex(filtex); }}
                onToggleNot={groupId => { actions.toggleFiltexNot(groupId); }}
                onReset={() => { actions.resetFiltex(); }}
                onClose={() => { setPickerOpen(false); }}
            />
        </Toolbar>
    );
}

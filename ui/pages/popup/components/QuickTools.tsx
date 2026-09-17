import { ActionTile } from '../../../shared/Tile';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import type { PopupActions, PopupState } from '../usePopup';

interface Props { state: PopupState; actions: PopupActions }

// Element picker, logger, dashboard as tonal action tiles.
export function QuickTools({ state, actions }: Props) {
    const noTip = state.data?.tooltipsDisabled === true;
    const tip = (key: string) => (noTip ? undefined : t(key));
    return (
        <div id="basicTools" className="ubv-ribbon ubv-ribbon-tools" role="toolbar" aria-label="Quick tools" data-more="c">
            <ActionTile id="gotoPick" className={state.canPick ? 'canPick' : 'isDisabled'} disabled={!state.canPick}
                icon={icons.picker} caption={t('popupTipPicker')} title={tip('popupTipPicker')} ariaLabel={t('popupTipPicker')}
                onClick={() => actions.gotoPick()} />
            <ActionTile className="ubv-tool-logger"
                icon={icons.logger} caption={t('popupTipLog')} title={tip('popupTipLog')} ariaLabel={t('popupTipLog')}
                onClick={ev => actions.gotoURL('logger-ui.html#_', ev.shiftKey)} />
            <ActionTile
                icon={icons.dashboard} caption={t('popupTipDashboard')} title={tip('popupTipDashboard')} ariaLabel={t('popupTipDashboard')}
                onClick={ev => actions.gotoURL('dashboard.html', ev.shiftKey)} />
        </div>
    );
}

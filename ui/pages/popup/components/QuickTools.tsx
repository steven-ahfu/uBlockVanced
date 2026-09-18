import { ActionTile } from '../../../shared/Tile';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import { Toolbar } from 'material-expressive-react';
import type { PopupActions, PopupState } from '../usePopup';

interface Props { state: PopupState; actions: PopupActions }

// Element picker, logger, dashboard as tonal action tiles. Icon only: the
// strings are already whole sentences ("Open the dashboard"), so they read
// as the tooltip rather than as a caption wrapped over two lines.
export function QuickTools({ state, actions }: Props) {
    const noTip = state.data?.tooltipsDisabled === true;
    const tip = (key: string) => (noTip ? undefined : t(key));
    return (
        <Toolbar variant="Docked" dockPosition="Top" size="Small" id="basicTools" className="ubv-ribbon ubv-ribbon-tools" aria-label="Quick tools" data-more="c">
            <ActionTile id="gotoPick" className={state.canPick ? 'canPick' : 'isDisabled'} disabled={!state.canPick}
                icon={icons.picker} title={tip('popupTipPicker')} ariaLabel={t('popupTipPicker')}
                onClick={() => actions.gotoPick()} />
            <ActionTile className="ubv-tool-logger"
                icon={icons.logger} title={tip('popupTipLog')} ariaLabel={t('popupTipLog')}
                onClick={ev => actions.gotoURL('logger-ui.html#_', ev.shiftKey)} />
            <ActionTile
                icon={icons.dashboard} title={tip('popupTipDashboard')} ariaLabel={t('popupTipDashboard')}
                onClick={ev => actions.gotoURL('dashboard.html', ev.shiftKey)} />
        </Toolbar>
    );
}

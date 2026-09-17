import { ToggleButton } from 'material-expressive-react/button';
import { Icon } from '../../../shared/Icon';
import { icons } from '../../../shared/icons';
import { tPlain } from '../../../shared/i18n';
import type { PopupActions, PopupState } from '../usePopup';

interface Props { state: PopupState; actions: PopupActions }

// The site power control: an M3E toggle button. Selected (iris) = filtering
// on; unselected with the .off class = filtering off for this site.
export function PowerControl({ state, actions }: Props) {
    const on = !state.off;
    const tip = tPlain(on ? 'popupPowerSwitchInfo1' : 'popupPowerSwitchInfo2');
    const disabled = state.data === null || state.data.pageURL === '';
    return (
        <ToggleButton
            id="switch"
            className={'ubv-power' + (on ? '' : ' off')}
            variant="default"
            shape="square"
            size="xlarge"
            selected={on}
            disabled={disabled}
            title={state.data?.tooltipsDisabled ? undefined : tip}
            aria-label={tip}
            onClick={ev => actions.togglePower(ev)}
        >
            <Icon svg={icons.power} className="ubv-power-icon" />
        </ToggleButton>
    );
}

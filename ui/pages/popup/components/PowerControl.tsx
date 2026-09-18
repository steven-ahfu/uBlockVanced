import { ToggleButton } from 'material-expressive-react/button';
import { Icon } from '../../../shared/Icon';
import { icons } from '../../../shared/icons';
import { tPlain } from '../../../shared/i18n';
import { powerStyle } from '../../../shared/metrics';
import type { PopupActions, PopupState } from '../usePopup';

interface Props { state: PopupState; actions: PopupActions }

// The site power control: an M3E tonal toggle between the two ruleset
// tool clusters. Selected = filtering on (primary-container, iris glyph);
// unselected with .off = filtering off (neutral, looser radius). Geometry
// comes from ui/shared/metrics.ts; colours from popup.css token remaps.
// No upstream #switch id, so none of popup-fenix.css's glyph rules leak.
export function PowerControl({ state, actions }: Props) {
    const on = !state.off;
    const tip = tPlain(on ? 'popupPowerSwitchInfo1' : 'popupPowerSwitchInfo2');
    const disabled = state.data === null || state.data.pageURL === '';
    return (
        <ToggleButton
            className={'ubv-power' + (on ? '' : ' off')}
            variant="tonal"
            shape="square"
            selected={on}
            disabled={disabled}
            style={powerStyle(on)}
            data-tip={state.data?.tooltipsDisabled ? undefined : tip}
            aria-label={tip}
            onClick={ev => actions.togglePower(ev)}
        >
            <Icon svg={icons.power} className="ubv-power-icon" />
        </ToggleButton>
    );
}

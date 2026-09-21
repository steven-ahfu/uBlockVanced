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
//
// The site is the button's label rather than a heading above it: the switch
// acts on that site and nothing else, and one row costs half the height two
// did. The registrable domain carries the emphasis, any subdomain prefix
// leads it in a muted weight.
export function PowerControl({ state, actions }: Props) {
    const on = !state.off;
    const action = tPlain(on ? 'popupPowerSwitchInfo1' : 'popupPowerSwitchInfo2');
    const disabled = state.data === null || state.data.pageURL === '';
    const hostname = state.data?.pageHostname ?? '';
    const domain = state.data?.pageDomain || hostname;
    const prefix = hostname.endsWith(domain) && hostname.length > domain.length
        ? hostname.slice(0, hostname.length - domain.length - 1) + '.'
        : '';
    const tip = hostname === '' ? action : `${hostname} — ${action}`;
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
            {hostname === '' ? null : (
                <span className="ubv-power-site">
                    <span className="ubv-power-prefix">{prefix}</span>
                    <span className="ubv-power-domain">{domain}</span>
                </span>
            )}
        </ToggleButton>
    );
}

import { ToggleTile } from '../../../shared/Tile';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import { Toolbar } from 'material-expressive-react';
import type { PopupActions, PopupState } from '../usePopup';
import type { SwitchName } from '../types';

interface Props { state: PopupState; actions: PopupActions }

interface SwitchDef {
    name: SwitchName;
    dataKey: 'noPopups' | 'noLargeMedia' | 'noCosmeticFiltering' | 'noRemoteFonts' | 'noScripting';
    icon: string;
    label: string;
    tip: string;
}

const defs: SwitchDef[] = [
    { name: 'no-popups', dataKey: 'noPopups', icon: icons.popups, label: 'popupNoPopups_v2', tip: 'popupTipNoPopups' },
    { name: 'no-large-media', dataKey: 'noLargeMedia', icon: icons.largeMedia, label: 'popupNoLargeMedia_v2', tip: 'popupTipNoLargeMedia' },
    { name: 'no-cosmetic-filtering', dataKey: 'noCosmeticFiltering', icon: icons.cosmetic, label: 'popupNoCosmeticFiltering_v2', tip: 'popupTipNoCosmeticFiltering' },
    { name: 'no-remote-fonts', dataKey: 'noRemoteFonts', icon: icons.fonts, label: 'popupNoRemoteFonts_v2', tip: 'popupTipNoRemoteFonts' },
    { name: 'no-scripting', dataKey: 'noScripting', icon: icons.scripting, label: 'popupNoScripting_v2', tip: 'popupTipNoScripting' },
];

const badgeText = (n: number | undefined | null): string =>
    typeof n === 'number' && n !== 0 ? Math.min(n, 99).toLocaleString() : '';

// Per-site switches as M3E toggle tiles, each with a count badge. The tile
// shows only its glyph; its name leads the tooltip, which then says what a
// click will do ("Cosmetic filtering — Click to disable ... on this site").
export function SiteSwitches({ state, actions }: Props) {
    const { data } = state;
    const noTip = data?.tooltipsDisabled === true;
    const counts: Record<SwitchName, string> = {
        'no-popups': badgeText(data?.popupBlockedCount),
        'no-large-media': badgeText(data?.largeMediaCount),
        'no-cosmetic-filtering': state.hiddenCount === null
            ? '⋯'
            : state.hiddenCount === -1 ? '?' : badgeText(state.hiddenCount),
        'no-remote-fonts': badgeText(data?.remoteFontCount),
        'no-scripting': badgeText(state.scriptCount),
    };
    return (
        <Toolbar variant="Docked" dockPosition="Top" size="Small" id="extraTools" className="ubv-ribbon ubv-ribbon-switches" aria-label="Per-site controls" data-more="d">
            {defs.map(def => {
                const on = data?.[def.dataKey] === true;
                const name = t(def.label);
                const tip = `${name} — ${t(def.tip + (on ? '2' : '1'))}`;
                return (
                    <ToggleTile
                        key={def.name}
                        id={def.name}
                        selected={on}
                        icon={def.icon}
                        badge={counts[def.name]}
                        title={noTip ? undefined : tip}
                        ariaLabel={tip}
                        onClick={ev => { actions.toggleSwitch(def.name, ev.ctrlKey || ev.metaKey); }}
                        onMouseEnter={def.name === 'no-cosmetic-filtering' ? () => actions.fetchHiddenCount() : undefined}
                    />
                );
            })}
        </Toolbar>
    );
}

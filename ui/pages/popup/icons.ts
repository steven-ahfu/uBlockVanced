// Material Symbols used only by the popup. Same pattern as ui/shared/icons.ts:
// esbuild inlines the SVG text, so nothing is fetched at runtime and the CSP
// stays `script-src 'self'`.
import block from '@material-symbols/svg-400/rounded/block.svg';
import checkCircle from '@material-symbols/svg-400/rounded/check_circle.svg';
import chevronRight from '@material-symbols/svg-400/rounded/chevron_right.svg';
import doNotDisturbOn from '@material-symbols/svg-400/rounded/do_not_disturb_on.svg';
import keyboardArrowDown from '@material-symbols/svg-400/rounded/keyboard_arrow_down.svg';

export const popupIcons = {
    // Row expanders in the dynamic filtering matrix.
    collapsed: chevronRight,
    expanded: keyboardArrowDown,
    // The three rules a matrix cell can be set to.
    allow: checkCircle,
    noop: doNotDisturbOn,
    block,
} as const;

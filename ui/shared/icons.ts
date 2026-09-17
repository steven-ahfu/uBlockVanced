// Every Material Symbols glyph the React UI uses, in one place. esbuild inlines
// the SVG text; unused icons never reach the bundle.
import close from '@material-symbols/svg-400/rounded/close.svg';
import code from '@material-symbols/svg-400/rounded/code.svg';
import colorize from '@material-symbols/svg-400/rounded/colorize.svg';
import filterAlt from '@material-symbols/svg-400/rounded/filter_alt.svg';
import fontDownload from '@material-symbols/svg-400/rounded/font_download.svg';
import inkEraser from '@material-symbols/svg-400/rounded/ink_eraser.svg';
import keyboardArrowDown from '@material-symbols/svg-400/rounded/keyboard_arrow_down.svg';
import keyboardArrowUp from '@material-symbols/svg-400/rounded/keyboard_arrow_up.svg';
import listAlt from '@material-symbols/svg-400/rounded/list_alt.svg';
import lock from '@material-symbols/svg-400/rounded/lock.svg';
import movie from '@material-symbols/svg-400/rounded/movie.svg';
import powerSettingsNew from '@material-symbols/svg-400/rounded/power_settings_new.svg';
import refresh from '@material-symbols/svg-400/rounded/refresh.svg';
import settings from '@material-symbols/svg-400/rounded/settings.svg';
import visibilityOff from '@material-symbols/svg-400/rounded/visibility_off.svg';
import warning from '@material-symbols/svg-400/rounded/warning.svg';
import webAsset from '@material-symbols/svg-400/rounded/web_asset.svg';

export const icons = {
    power: powerSettingsNew,
    more: keyboardArrowDown,
    less: keyboardArrowUp,
    lock,
    eraser: inkEraser,
    refresh,
    picker: colorize,
    logger: listAlt,
    dashboard: settings,
    popups: webAsset,
    largeMedia: movie,
    cosmetic: visibilityOff,
    fonts: fontDownload,
    scripting: code,
    filter: filterAlt,
    close,
    warning,
} as const;

export type IconName = keyof typeof icons;

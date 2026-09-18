// Every Material Symbols glyph the React UI uses, in one place. esbuild inlines
// the SVG text; unused icons never reach the bundle.
import add from '@material-symbols/svg-400/rounded/add.svg';
import block from '@material-symbols/svg-400/rounded/block.svg';
import check from '@material-symbols/svg-400/rounded/check.svg';
import close from '@material-symbols/svg-400/rounded/close.svg';
import code from '@material-symbols/svg-400/rounded/code.svg';
import colorize from '@material-symbols/svg-400/rounded/colorize.svg';
import dataObject from '@material-symbols/svg-400/rounded/data_object.svg';
import deleteIcon from '@material-symbols/svg-400/rounded/delete.svg';
import download from '@material-symbols/svg-400/rounded/download.svg';
import difference from '@material-symbols/svg-400/rounded/difference.svg';
import filterAlt from '@material-symbols/svg-400/rounded/filter_alt.svg';
import fontDownload from '@material-symbols/svg-400/rounded/font_download.svg';
import help from '@material-symbols/svg-400/rounded/help.svg';
import home from '@material-symbols/svg-400/rounded/home.svg';
import info from '@material-symbols/svg-400/rounded/info.svg';
import inkEraser from '@material-symbols/svg-400/rounded/ink_eraser.svg';
import keyboardArrowDown from '@material-symbols/svg-400/rounded/keyboard_arrow_down.svg';
import keyboardArrowUp from '@material-symbols/svg-400/rounded/keyboard_arrow_up.svg';
import linkOff from '@material-symbols/svg-400/rounded/link_off.svg';
import listAlt from '@material-symbols/svg-400/rounded/list_alt.svg';
import lock from '@material-symbols/svg-400/rounded/lock.svg';
import lockOpen from '@material-symbols/svg-400/rounded/lock_open.svg';
import movie from '@material-symbols/svg-400/rounded/movie.svg';
import openInNew from '@material-symbols/svg-400/rounded/open_in_new.svg';
import powerSettingsNew from '@material-symbols/svg-400/rounded/power_settings_new.svg';
import refresh from '@material-symbols/svg-400/rounded/refresh.svg';
import schedule from '@material-symbols/svg-400/rounded/schedule.svg';
import search from '@material-symbols/svg-400/rounded/search.svg';
import settings from '@material-symbols/svg-400/rounded/settings.svg';
import travelExplore from '@material-symbols/svg-400/rounded/travel_explore.svg';
import undo from '@material-symbols/svg-400/rounded/undo.svg';
import upload from '@material-symbols/svg-400/rounded/upload.svg';
import visibility from '@material-symbols/svg-400/rounded/visibility.svg';
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
    check,
    search,
    view: visibility,
    home,
    info,
    help,
    remove: deleteIcon,
    unsecure: lockOpen,
    clock: schedule,
    failed: linkOff,
    diff: difference,
    external: openInNew,
    add,
    block,
    download,
    upload,
    undo,
    json: dataObject,
    domains: travelExplore,
} as const;

export type IconName = keyof typeof icons;

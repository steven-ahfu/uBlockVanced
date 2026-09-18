// uBlockVanced - Material Symbols used by the logger page only. The shared
// ui/shared/icons.ts stays untouched; esbuild inlines the SVG text here.
import barChart from '@material-symbols/svg-400/rounded/bar_chart.svg';
import close from '@material-symbols/svg-400/rounded/close.svg';
import code from '@material-symbols/svg-400/rounded/code.svg';
import contentCopy from '@material-symbols/svg-400/rounded/content_copy.svg';
import contentPaste from '@material-symbols/svg-400/rounded/content_paste.svg';
import filterAlt from '@material-symbols/svg-400/rounded/filter_alt.svg';
import inkEraser from '@material-symbols/svg-400/rounded/ink_eraser.svg';
import keyboardArrowDown from '@material-symbols/svg-400/rounded/keyboard_arrow_down.svg';
import keyboardArrowUp from '@material-symbols/svg-400/rounded/keyboard_arrow_up.svg';
import keyboardDoubleArrowLeft from '@material-symbols/svg-400/rounded/keyboard_double_arrow_left.svg';
import keyboardDoubleArrowUp from '@material-symbols/svg-400/rounded/keyboard_double_arrow_up.svg';
import menuBook from '@material-symbols/svg-400/rounded/menu_book.svg';
import openInNew from '@material-symbols/svg-400/rounded/open_in_new.svg';
import pauseCircle from '@material-symbols/svg-400/rounded/pause_circle.svg';
import playCircle from '@material-symbols/svg-400/rounded/play_circle.svg';
import refresh from '@material-symbols/svg-400/rounded/refresh.svg';
import save from '@material-symbols/svg-400/rounded/save.svg';
import search from '@material-symbols/svg-400/rounded/search.svg';
import settings from '@material-symbols/svg-400/rounded/settings.svg';
import tableRows from '@material-symbols/svg-400/rounded/table_rows.svg';
import terminal from '@material-symbols/svg-400/rounded/terminal.svg';
import undo from '@material-symbols/svg-400/rounded/undo.svg';
import volumeUp from '@material-symbols/svg-400/rounded/volume_up.svg';
import webAsset from '@material-symbols/svg-400/rounded/web_asset.svg';

export const loggerIcons = {
    clean: close,
    clear: inkEraser,
    close,
    commit: save,
    console: terminal,
    copy: contentCopy,
    dom: code,
    expandLess: keyboardArrowUp,
    expandMore: keyboardArrowDown,
    export: contentPaste,
    external: openInNew,
    filter: filterAlt,
    hCompact: keyboardDoubleArrowLeft,
    pause: pauseCircle,
    play: playCircle,
    popup: webAsset,
    refresh,
    revert: undo,
    rows: tableRows,
    search,
    settings,
    stats: barChart,
    vExpand: keyboardDoubleArrowUp,
    verbose: volumeUp,
    wiki: menuBook,
} as const;

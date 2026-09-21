// Page-local Material Symbols for the Element Probe panel (shared/icons.ts is
// owned by the parent; add there when the pages are merged).
import adsClick from '@material-symbols/svg-400/rounded/ads_click.svg';
import codeBlocks from '@material-symbols/svg-400/rounded/code_blocks.svg';
import contentCopy from '@material-symbols/svg-400/rounded/content_copy.svg';
import cropFree from '@material-symbols/svg-400/rounded/crop_free.svg';
import deployedCode from '@material-symbols/svg-400/rounded/deployed_code.svg';
import frameInspect from '@material-symbols/svg-400/rounded/frame_inspect.svg';
import frameSource from '@material-symbols/svg-400/rounded/frame_source.svg';
import history from '@material-symbols/svg-400/rounded/history.svg';
import layers from '@material-symbols/svg-400/rounded/layers.svg';
import manageSearch from '@material-symbols/svg-400/rounded/manage_search.svg';
import redo from '@material-symbols/svg-400/rounded/redo.svg';
import rule from '@material-symbols/svg-400/rounded/rule.svg';
import save from '@material-symbols/svg-400/rounded/save.svg';
import smartDisplay from '@material-symbols/svg-400/rounded/smart_display.svg';
import terminal from '@material-symbols/svg-400/rounded/terminal.svg';
import timer from '@material-symbols/svg-400/rounded/timer.svg';

export const pageIcons = {
    copy: contentCopy,
    element: codeBlocks,
    history,
    inspect: frameInspect,
    iframes: frameSource,
    log: terminal,
    pick: adsClick,
    procedural: rule,
    redo,
    save,
    selectors: manageSearch,
    shadow: layers,
    shadowBadge: deployedCode,
    target: cropFree,
    test: timer,
    youtube: smartDisplay,
} as const;

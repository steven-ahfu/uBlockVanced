// Page-local glyphs not in ui/shared/icons.ts.
import arrowBack from '@material-symbols/svg-400/rounded/arrow_back.svg';
import arrowForward from '@material-symbols/svg-400/rounded/arrow_forward.svg';
import save from '@material-symbols/svg-400/rounded/save.svg';
import unfoldLess from '@material-symbols/svg-400/rounded/unfold_less.svg';
import unfoldMore from '@material-symbols/svg-400/rounded/unfold_more.svg';

export const pageIcons = {
    revert: arrowForward,
    commit: arrowBack,
    save,
    collapse: unfoldLess,
    expand: unfoldMore,
} as const;

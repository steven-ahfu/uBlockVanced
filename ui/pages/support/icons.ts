// Icons only the Support page uses (see ui/shared/icons.ts for the shared set).
import bugReport from '@material-symbols/svg-400/rounded/bug_report.svg';
import forum from '@material-symbols/svg-400/rounded/forum.svg';
import menuBook from '@material-symbols/svg-400/rounded/menu_book.svg';
import monitoring from '@material-symbols/svg-400/rounded/monitoring.svg';
import report from '@material-symbols/svg-400/rounded/report.svg';
import selectAll from '@material-symbols/svg-400/rounded/select_all.svg';

export const supportIcons = {
    bug: bugReport,
    forum,
    docs: menuBook,
    more: monitoring,
    report,
    selectAll,
} as const;

// Page-local Material Symbols for the Settings page (shared/icons.ts is owned
// by the parent; add there when the pages are merged).
import backup from '@material-symbols/svg-400/rounded/backup.svg';
import cloudDownload from '@material-symbols/svg-400/rounded/cloud_download.svg';
import restartAlt from '@material-symbols/svg-400/rounded/restart_alt.svg';
import tune from '@material-symbols/svg-400/rounded/tune.svg';

export const pageIcons = {
    backup,
    restore: cloudDownload,
    reset: restartAlt,
    advanced: tune,
} as const;

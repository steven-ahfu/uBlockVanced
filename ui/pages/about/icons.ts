// Icons only the About page uses (see ui/shared/icons.ts for the shared set).
import code from '@material-symbols/svg-400/rounded/code.svg';
import description from '@material-symbols/svg-400/rounded/description.svg';
import group from '@material-symbols/svg-400/rounded/group.svg';
import history from '@material-symbols/svg-400/rounded/history.svg';
import policy from '@material-symbols/svg-400/rounded/policy.svg';
import publicIcon from '@material-symbols/svg-400/rounded/public.svg';
import translate from '@material-symbols/svg-400/rounded/translate.svg';

export const aboutIcons = {
    code,
    lists: description,
    group,
    history,
    policy,
    public: publicIcon,
    translate,
} as const;

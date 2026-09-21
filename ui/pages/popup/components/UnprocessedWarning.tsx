import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import type { PopupActions, PopupState } from '../usePopup';

interface Props { state: PopupState; actions: PopupActions }

export function UnprocessedWarning({ state, actions }: Props) {
    return (
        <div id="unprocessedRequestWarning" className="ubv-warning" role="status" aria-live="polite">
            <Icon svg={icons.warning} className="ubv-warning-icon" />
            <span>{t('unprocessedRequestTooltip')}</span>
            <IconButton className="dismiss" variant="standard" aria-label="Dismiss"
                onClick={() => actions.dismissWarning()}>
                <Icon svg={icons.close} />
            </IconButton>
            {state.warn ? null : null}
        </div>
    );
}

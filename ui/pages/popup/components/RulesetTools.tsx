import { IconButton } from 'material-expressive-react/icon-button';
import { Icon } from '../../../shared/Icon';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import type { PopupActions, PopupState } from '../usePopup';

interface Props { state: PopupState; actions: PopupActions; side: 'start' | 'end' }

// Left cluster: more, save, revert. Right cluster: less, reload.
// Save/revert/reload only show when there is something to save or reload
// (upstream keys this on body.needSave / body.needReload).
export function RulesetTools({ state, actions, side }: Props) {
    const noTip = state.data?.tooltipsDisabled === true;
    const tip = (key: string) => (noTip ? undefined : t(key));
    if ( side === 'start' ) {
        return (
            <div className="rulesetTools ubv-cluster">
                <IconButton id="moreButton" variant="standard" size="small"
                    disabled={!state.canMore} title={tip('popupMoreButton_v2')} aria-label={t('popupMoreButton_v2')}
                    onClick={() => actions.toggleSections(true)}>
                    <Icon svg={icons.more} />
                </IconButton>
                {state.needSave ? (
                    <>
                        <IconButton id="saveRules" variant="tonal" size="small" title={tip('popupTipSaveRules')}
                            aria-label={t('popupTipSaveRules')} onClick={() => actions.saveRules()}>
                            <Icon svg={icons.lock} />
                        </IconButton>
                        <IconButton id="revertRules" variant="standard" size="small" title={tip('popupTipRevertRules')}
                            aria-label={t('popupTipRevertRules')} onClick={() => { actions.revertRules(); }}>
                            <Icon svg={icons.eraser} />
                        </IconButton>
                    </>
                ) : null}
            </div>
        );
    }
    return (
        <div className="rulesetTools ubv-cluster ubv-cluster-end">
            {state.needReload ? (
                <IconButton id="refresh" variant="tonal" size="small" title={noTip ? undefined : 'Reload the current page'}
                    aria-label="Reload the current page"
                    onClick={ev => actions.reloadTab(ev.ctrlKey || ev.metaKey || ev.shiftKey)}>
                    <Icon svg={icons.refresh} />
                </IconButton>
            ) : null}
            <IconButton id="lessButton" variant="standard" size="small"
                disabled={!state.canLess} title={tip('popupLessButton_v2')} aria-label={t('popupLessButton_v2')}
                onClick={() => actions.toggleSections(false)}>
                <Icon svg={icons.less} />
            </IconButton>
        </div>
    );
}

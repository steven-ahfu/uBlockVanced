import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import type { PopupActions, PopupState } from '../usePopup';

interface Props { state: PopupState; actions: PopupActions; side: 'start' | 'end' }

// Left cluster: more, save, revert. Right cluster: less, reload.
// Save/revert/reload only render when there is something to save or
// reload. The buttons carry no upstream ids or classes on purpose:
// popup-fenix.css keys sizes and backgrounds on `.rulesetTools [id]`, which
// would fight the Material host box.
export function RulesetTools({ state, actions, side }: Props) {
    const noTip = state.data?.tooltipsDisabled === true;
    const tip = (key: string) => (noTip ? undefined : t(key));
    if ( side === 'start' ) {
        return (
            <div className="ubv-cluster">
                <IconButton variant="standard"
                    disabled={!state.canMore} data-tip={tip('popupMoreButton_v2')} aria-label={t('popupMoreButton_v2')}
                    onClick={() => actions.toggleSections(true)}>
                    <Icon svg={icons.more} />
                </IconButton>
                {state.needSave ? (
                    <>
                        <IconButton variant="tonal" data-tip={tip('popupTipSaveRules')}
                            aria-label={t('popupTipSaveRules')} onClick={() => actions.saveRules()}>
                            <Icon svg={icons.lock} />
                        </IconButton>
                        <IconButton variant="standard" data-tip={tip('popupTipRevertRules')}
                            aria-label={t('popupTipRevertRules')} onClick={() => { actions.revertRules(); }}>
                            <Icon svg={icons.eraser} />
                        </IconButton>
                    </>
                ) : null}
            </div>
        );
    }
    return (
        <div className="ubv-cluster ubv-cluster-end">
            {state.needReload ? (
                <IconButton variant="tonal" data-tip={noTip ? undefined : 'Reload the current page'}
                    aria-label="Reload the current page"
                    onClick={ev => actions.reloadTab(ev.ctrlKey || ev.metaKey || ev.shiftKey)}>
                    <Icon svg={icons.refresh} />
                </IconButton>
            ) : null}
            <IconButton variant="standard"
                disabled={!state.canLess} data-tip={tip('popupLessButton_v2')} aria-label={t('popupLessButton_v2')}
                onClick={() => actions.toggleSections(false)}>
                <Icon svg={icons.less} />
            </IconButton>
        </div>
    );
}

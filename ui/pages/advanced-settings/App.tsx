import { FilledButton, FilledTonalButton } from 'material-expressive-react/button';
import { CircularProgress } from 'material-expressive-react/progress';
import { useRef } from 'react';
import { Icon } from '../../shared/Icon';
import { icons } from '../../shared/icons';
import { Tooltips } from '../../shared/Tooltip';
import { t, tf } from '../../shared/i18n';
import { useAdvancedSettings } from './useAdvancedSettings';
import type { Tone } from './useAdvancedSettings';
import { useEditor } from './useEditor';
import { Card } from '../../shared/Card';
import { Pill, Pills } from '../../shared/Pill';
import type { PillTone } from '../../shared/Pill';

const pillTone = (tone: Tone): PillTone => {
    switch ( tone ) {
    case 'accent': return 'accent';
    case 'warning': return 'warning';
    case 'success': return 'accent';
    default: return 'neutral';
    }
};

export function App() {
    // The editor reports changes before the page hook exists; route through a ref.
    const syncRef = useRef<() => void>(() => {});
    const [ host, cm ] = useEditor(() => syncRef.current());
    const [ state, actions ] = useAdvancedSettings(cm);
    syncRef.current = actions.sync;

    const busy = state.changed === false || state.applying;
    const policyHint = state.lockedCount !== 0
        ? tf('advancedSettingsPolicyHintLocked', { count: state.lockedCount, total: state.totalCount })
        : tf('advancedSettingsPolicyHintClear', { total: state.totalCount });

    return (
        <div className="ubv-page ubv-editor-page">
            <header className="ubv-page-header">
                <div className="ubv-page-copy">
                    <div className="ubv-eyebrow" translate="no">uBlockVanced</div>
                    <h1 className="ubv-title">{t('advancedSettingsPageName')}</h1>
                </div>
                <Pills role="status" aria-live="polite" aria-atomic="true">
                    <Pill tone={pillTone(state.saveTone)} label={t(state.saveKey)} />
                    <Pill tone={state.customizedCount !== 0 ? 'accent' : 'neutral'}
                        label={tf('advancedSettingsCustomizedCount', { count: state.customizedCount })} />
                    <Pill tone={state.lockedCount !== 0 ? 'warning' : 'neutral'}
                        label={state.lockedCount !== 0
                            ? tf('advancedSettingsLockCount', { count: state.lockedCount })
                            : t('advancedSettingsLockCountNone')} />
                </Pills>
            </header>

            <Card className="ubv-workbench" aria-label={t('advancedSettingsPageName')}>
                <div className="ubv-actions">
                    <FilledButton disabled={busy} data-tip={t('genericApplyChanges')} onClick={() => { actions.apply(); }}>
                        {state.applying
                            ? <CircularProgress slot="icon" indeterminate className="ubv-button-progress" />
                            : <Icon slot="icon" svg={icons.check} />}
                        {t('genericApplyChanges')}
                    </FilledButton>
                    <FilledTonalButton disabled={busy} data-tip={t('genericRevert')} onClick={() => { actions.revert(); }}>
                        <Icon slot="icon" svg={icons.undo} />
                        {t('genericRevert')}
                    </FilledTonalButton>
                </div>
                <p className="ubv-notice ubv-notice-warning">{t('advancedSettingsWarning')}</p>
                <p className="ubv-muted" id="advancedSettingsPolicyHint">{state.ready ? policyHint : ''}</p>
            </Card>

            <Card className={'ubv-editor-card' + (state.changed ? ' is-dirty' : '')} aria-label={t('advancedSettingsPageName')}>
                <div id="advancedSettings" ref={host} className="codeMirrorContainer cm-theme-override"
                    data-dirty={state.changed ? 'true' : 'false'}></div>
            </Card>
            <Tooltips />
        </div>
    );
}

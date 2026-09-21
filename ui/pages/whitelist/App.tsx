import { FilledButton, FilledTonalButton, OutlinedButton } from 'material-expressive-react/button';
import { useRef } from 'react';
import { CloudWidget } from '../../shared/CloudWidget';
import { Icon } from '../../shared/Icon';
import { FilePicker } from '../../shared/FilePicker';
import { icons } from '../../shared/icons';
import { Tooltips } from '../../shared/Tooltip';
import { t } from '../../shared/i18n';
import { useEditor } from './useEditor';
import type { WhitelistRules } from './useEditor';
import { useWhitelist } from './useWhitelist';
import { Card } from '../../shared/Card';
import { Pill, Pills } from '../../shared/Pill';
import { Toolbar } from 'material-expressive-react';

export function App() {
    // Validation rules arrive with `getWhitelist`; the editor mode reads
    // them through this ref on every tokenised line.
    const rules = useRef<WhitelistRules | null>(null);
    // The editor fires change/save callbacks before the page hook exists, so
    // they go through refs that the hook fills in on every render.
    const syncRef = useRef<() => void>(() => {});
    const saveRef = useRef<() => void>(() => {});
    const [ host, editor ] = useEditor(rules, () => syncRef.current(), () => saveRef.current());
    const [ state, actions ] = useWhitelist(editor, rules);
    syncRef.current = actions.sync;
    saveRef.current = () => { if ( state.changed && state.bad === false ) { actions.apply(); } };


    return (
        <div className="ubv-page ubv-editor-page">
            <header className="ubv-page-header">
                <div className="ubv-page-copy">
                    <div className="ubv-eyebrow" translate="no">uBlockVanced</div>
                    <h1 className="ubv-title">{t('whitelistPageName')}</h1>
                    <p className="ubv-lead">{t('whitelistPrompt')}</p>
                </div>
                <Pills role="status" aria-live="polite" aria-atomic="true">
                    <Pill tone={state.changed ? 'warning' : 'accent'} label={state.saveLabel} />
                    <Pill tone={state.bad ? 'error' : 'neutral'} label={state.validationLabel} />
                    <Pill tone={state.customCount === 0 ? 'neutral' : 'accent'} label={state.countLabel} />
                </Pills>
            </header>

            <CloudWidget datakey="whitelistPane" />

            <Card className="ubv-workbench" aria-label={t('whitelistPageName')}>
                <Toolbar variant="Docked" dockPosition="Top" size="Small" className="ubv-toolbar">
                    <div className="ubv-actions">
                        <FilledButton disabled={!state.changed || state.bad} data-tip={t('whitelistApply')} onClick={() => { actions.apply(); }}>
                            <Icon slot="icon" svg={icons.check} />
                            {t('whitelistApply')}
                        </FilledButton>
                        <FilledTonalButton disabled={!state.changed} data-tip={t('genericRevert')} onClick={() => { actions.revert(); }}>
                            <Icon slot="icon" svg={icons.undo} />
                            {t('genericRevert')}
                        </FilledTonalButton>
                    </div>
                    <div className="ubv-actions ubv-actions-end">
                        <FilePicker
                            label={t('whitelistImport')}
                            icon={icons.download}
                            accept="text/plain,.txt"
                            inputName="whitelistImport"
                            onFile={file => { actions.importFile(file); }}
                        />
                        <OutlinedButton disabled={!state.hasContent} data-tip={t('whitelistExport')} onClick={() => { actions.exportText(); }}>
                            <Icon slot="icon" svg={icons.upload} />
                            {t('whitelistExport')}
                        </OutlinedButton>
                    </div>
                </Toolbar>
                {state.bad ? <p className="ubv-notice ubv-notice-warning" role="status">{t('whitelistStatusNeedsReview')}</p> : null}
            </Card>

            <Card className="ubv-editor-card" aria-label={t('whitelistPageName')}>
                <div id="whitelist" ref={host} className="codeMirrorContainer cm-theme-override"></div>
            </Card>

            <Tooltips />
        </div>
    );
}

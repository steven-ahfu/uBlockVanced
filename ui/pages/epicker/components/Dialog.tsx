import { CandidateLists, ResultsetSliders } from './FilterLists';
import { FilledButton, FilledTonalButton, TextButton } from 'material-expressive-react/button';
import { SecondaryTab, Tabs } from 'material-expressive-react/tabs';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { ProbeList } from './ProbeList';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import { useEditor } from '../useEditor';
import type { PickerActions, PickerState } from '../usePicker';

interface Props { state: PickerState; actions: PickerActions; onGrab(ev: React.PointerEvent): void }

// The floating dialog. Everything that Material has a component for is one;
// the panel shell, the drag handle and the editor host are the three things it
// does not, and epicker.css styles those with the same tokens.
export function Dialog({ state, actions, onGrab }: Props) {
    const editorHost = useEditor(actions.onEditorChanged, actions.registerEditor);

    return (
        <aside className={state.invalidFilter ? 'invalidFilter' : undefined}>
            <div className="ubv-windowbar">
                <IconButton
                    variant="standard"
                    aria-label={t('epickerMinimize')}
                    data-tip={t('epickerMinimize')}
                    onClick={actions.toggleMinimize}
                >
                    <Icon svg={icons.less} />
                </IconButton>
                <div className="ubv-grip" onPointerDown={onGrab} aria-hidden="true" />
                <IconButton
                    variant="standard"
                    aria-label={t('pickerQuit')}
                    data-tip={t('pickerQuit')}
                    onClick={actions.quit}
                >
                    <Icon svg={icons.close} />
                </IconButton>
            </div>

            <section>
                <div className="ubv-editor">
                    <div className="ubv-editor-host" ref={editorHost} />
                    <span className="ubv-count" aria-live="polite">{state.resultsetCount}</span>
                </div>

                <ResultsetSliders state={state} actions={actions} />

                <div className="ubv-actions">
                    <TextButton onClick={actions.pick}>{t('pickerPick')}</TextButton>
                    <FilledTonalButton
                        className={state.preview ? 'active' : undefined}
                        onClick={actions.togglePreview}
                    >
                        {t('pickerPreview')}
                    </FilledTonalButton>
                    <FilledButton
                        disabled={state.createDisabled}
                        onClick={actions.create}
                    >
                        {t('pickerCreate')}
                    </FilledButton>
                </div>
            </section>

            <Tabs
                className="ubv-modes"
                activeTabIndex={state.mode === 'probe' ? 1 : 0}
                onChange={ev => {
                    const index = (ev.target as unknown as { activeTabIndex: number }).activeTabIndex;
                    actions.setMode(index === 1 ? 'probe' : 'classic');
                }}
            >
                <SecondaryTab id="modeClassic">{t('pickerModeClassic')}</SecondaryTab>
                <SecondaryTab id="modeProbe">{t('pickerModeProbe')}</SecondaryTab>
            </Tabs>

            <div className="ubv-panel">
                {state.mode === 'probe'
                    ? <ProbeList state={state} actions={actions} />
                    : <CandidateLists state={state} actions={actions} />}
            </div>
        </aside>
    );
}

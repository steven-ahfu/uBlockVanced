import { FilledButton, FilledTonalButton, OutlinedButton } from 'material-expressive-react/button';
import { OutlinedSelect, SelectOption } from 'material-expressive-react/select';
import { Textfield } from 'material-expressive-react/textfield';
import { CloudWidget } from '../../shared/CloudWidget';
import { Icon } from '../../shared/Icon';
import { FilePicker } from '../../shared/FilePicker';
import { IconButton } from '../../shared/IconButton';
import { icons } from '../../shared/icons';
import { Tooltips } from '../../shared/Tooltip';
import { t } from '../../shared/i18n';
import { pageIcons } from './icons';
import { useDynaRules } from './useDynaRules';
import { useMergeView } from './useMergeView';
import { Card } from '../../shared/Card';
import { Pill, Pills } from '../../shared/Pill';
import { Toolbar } from 'material-expressive-react';

const COLLAPSE_TIP = 'Collapse unchanged rules';
const FILTER_TIP = 'Filter rules';

export function App() {
    const [ host, merge ] = useMergeView();
    const [ state, actions ] = useDynaRules(merge);

    const editing = state.isClean === false;
    const status = editing ? t('rulesEditSave') : state.isDirty ? t('rulesTemporaryHeader') : t('rulesPermanentHeader');

    return (
        <div className="ubv-page ubv-editor-page ubv-rules-page">
            <header className="ubv-page-header">
                <div className="ubv-page-copy">
                    <div className="ubv-eyebrow" translate="no">uBlockVanced</div>
                    <h1 className="ubv-title">{t('rulesPageName')}</h1>
                </div>
                <Pills role="status" aria-live="polite" aria-atomic="true">
                    <Pill tone={editing ? 'warning' : state.isDirty ? 'accent' : 'neutral'} label={status} />
                </Pills>
            </header>

            <CloudWidget datakey="myRulesPane" />

            <Card id="diff" className={'ubv-rules-tools' + (state.isDirty ? ' dirty' : '')} aria-label={t('rulesPageName')}>
                <Toolbar variant="Docked" dockPosition="Top" size="Small" className="ubv-rules-groups">
                    <div className="ubv-rules-group" role="group" aria-label={t('rulesPermanentHeader')}>
                        <h2 className="ubv-card-title">{t('rulesPermanentHeader')}</h2>
                        <div className="ubv-actions">
                            <OutlinedButton id="exportButton" disabled={editing} data-tip={t('rulesExport')} onClick={() => { actions.exportFile(); }}>
                                <Icon slot="icon" svg={icons.upload} />
                                {t('rulesExport')}
                            </OutlinedButton>
                            <FilledTonalButton id="revertButton" disabled={editing || state.isDirty === false} trailingIcon
                                data-tip={t('rulesRevert')} onClick={() => { actions.revertAll(); }}>
                                <Icon slot="icon" svg={pageIcons.revert} />
                                {t('rulesRevert')}
                            </FilledTonalButton>
                        </div>
                    </div>
                    <div className="ubv-rules-group" role="group" aria-label={t('rulesTemporaryHeader')}>
                        <h2 className="ubv-card-title">{t('rulesTemporaryHeader')}</h2>
                        <div className="ubv-actions">
                            <FilledTonalButton id="commitButton" disabled={editing || state.isDirty === false}
                                data-tip={t('rulesCommit')} onClick={() => { actions.commitAll(); }}>
                                <Icon slot="icon" svg={pageIcons.commit} />
                                {t('rulesCommit')}
                            </FilledTonalButton>
                            <FilePicker
                                id="importButton"
                                label={t('rulesImport')}
                                icon={icons.download}
                                accept="text/plain"
                                disabled={editing}
                                onFile={file => { actions.importFile(file); }}
                            />
                            <FilledButton id="editSaveButton" disabled={editing === false} data-tip={t('rulesEditSave')} onClick={() => { actions.editSave(); }}>
                                <Icon slot="icon" svg={pageIcons.save} />
                                {t('rulesEditSave')}
                            </FilledButton>
                        </div>
                    </div>
                </Toolbar>
            </Card>

            <Card id="ruleFilter" className="ubv-rules-filter" aria-label={FILTER_TIP}>
                <Textfield
                    className="ubv-field"
                    variant="outlined"
                    type="search"
                    placeholder={FILTER_TIP}
                    aria-label={FILTER_TIP}
                    value={state.filter}
                    disabled={editing}
                    hasLeadingIcon
                    onInput={ev => { actions.setFilter((ev.target as HTMLInputElement).value); }}
                >
                    <Icon slot="leading-icon" svg={icons.filter} />
                </Textfield>
                <OutlinedSelect
                    className="ubv-rules-sort"
                    label={t('rulesSort').replace(/:\s*$/, '')}
                    value={String(state.sortType)}
                    onChange={ev => { actions.setSortType(parseInt((ev.target as HTMLSelectElement).value, 10) || 0); }}
                >
                    <SelectOption value="0" selected={state.sortType === 0}><div slot="headline">{t('rulesSortByType')}</div></SelectOption>
                    <SelectOption value="1" selected={state.sortType === 1}><div slot="headline">{t('rulesSortBySource')}</div></SelectOption>
                    <SelectOption value="2" selected={state.sortType === 2}><div slot="headline">{t('rulesSortByDestination')}</div></SelectOption>
                </OutlinedSelect>
                <IconButton id="diffCollapse" variant={state.isCollapsed ? 'tonal' : 'standard'}
                    aria-pressed={state.isCollapsed ? 'true' : 'false'} aria-label={COLLAPSE_TIP} data-tip={COLLAPSE_TIP}
                    onClick={() => { actions.toggleCollapsed(); }}>
                    <Icon svg={state.isCollapsed ? pageIcons.expand : pageIcons.collapse} />
                </IconButton>
            </Card>

            <Card className="ubv-editor-card" aria-label={t('rulesPageName')}>
                <div ref={host} className="codeMirrorContainer codeMirrorMergeContainer cm-theme-override"></div>
            </Card>

            <Tooltips />
        </div>
    );
}

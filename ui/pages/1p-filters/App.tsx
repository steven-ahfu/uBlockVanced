import { FilledButton, FilledTonalButton, OutlinedButton } from 'material-expressive-react/button';
import { Checkbox } from 'material-expressive-react/checkbox';
import { ChipSet, InputChip } from 'material-expressive-react/chips';
import { CircularProgress } from 'material-expressive-react/progress';
import { Textfield } from 'material-expressive-react/textfield';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CloudWidget } from '../../shared/CloudWidget';
import { Icon } from '../../shared/Icon';
import { List, ListItem } from '../../shared/ListItem';
import { icons } from '../../shared/icons';
import { Tooltips } from '../../shared/Tooltip';
import { t } from '../../shared/i18n';
import { useEditor } from './useEditor';
import { useUserFilters } from './useUserFilters';
import { Card } from '../../shared/Card';
import { Pill, Pills } from '../../shared/Pill';
import { Toolbar } from 'material-expressive-react';

const CHECK_DOMAINS_TIP = 'Sends HTTP HEAD requests to domains in your filters to check reachability. Your IP is visible to each domain checked.';
const JSON_TIP = 'Export as shareable JSON with structured rules';

// The row itself is the toggle, so the checkbox in its end slot swallows its
// own click instead of letting it reach the row.
const stopRowToggle = (ev: React.MouseEvent): void => { ev.stopPropagation(); };

export function App() {
    // The editor fires change/save callbacks before the page hook exists, so
    // they go through refs that the hook fills in on every render.
    const syncRef = useRef<() => void>(() => {});
    const saveRef = useRef<() => void>(() => {});
    const [ host, editor ] = useEditor(() => syncRef.current(), () => saveRef.current());
    const [ state, actions ] = useUserFilters(editor);
    syncRef.current = actions.sync;
    saveRef.current = () => { actions.apply(); };

    const filePicker = useRef<HTMLInputElement>(null);
    const [ siteInput, setSiteInput ] = useState('');

    const onSiteSubmit = async (ev: FormEvent) => {
        ev.preventDefault();
        if ( await actions.addSite(siteInput) ) { setSiteInput(''); }
    };

    const trustActive = state.enabled && state.trusted;

    return (
        <div className="ubv-page ubv-editor-page">
            <header className="ubv-page-header">
                <div className="ubv-page-copy">
                    <div className="ubv-eyebrow" translate="no">uBlockVanced</div>
                    <h1 className="ubv-title">{t('1pPageName')}</h1>
                </div>
                <Pills role="status" aria-live="polite" aria-atomic="true">
                    <Pill tone={state.changed ? 'warning' : 'accent'} label={t(state.changed ? '1pEditorStatusUnsaved' : '1pEditorStatusSaved')} />
                    <Pill tone={state.enabled ? 'accent' : 'neutral'} label={t(state.enabled ? '1pEditorStateEnabled' : '1pEditorStateDisabled')} />
                    <Pill tone={trustActive ? 'accent' : 'neutral'} label={t(trustActive ? '1pEditorTrustEnabled' : '1pEditorTrustStandard')} />
                </Pills>
            </header>

            <CloudWidget datakey="myFiltersPane" />

            <Card className="ubv-workbench" aria-label={t('1pPageName')}>
                <Toolbar variant="Docked" dockPosition="Top" size="Small" className="ubv-toolbar">
                    <div className="ubv-actions">
                        <FilledButton disabled={!state.changed} data-tip={t('1pApplyChanges')} onClick={() => { actions.apply(); }}>
                            <Icon slot="icon" svg={icons.check} />
                            {t('1pApplyChanges')}
                        </FilledButton>
                        <FilledTonalButton disabled={!state.changed} data-tip={t('genericRevert')} onClick={() => { actions.revert(); }}>
                            <Icon slot="icon" svg={icons.undo} />
                            {t('genericRevert')}
                        </FilledTonalButton>
                    </div>
                    <div className="ubv-actions ubv-actions-end">
                        <OutlinedButton data-tip={t('1pImport')} onClick={() => {
                            const input = filePicker.current;
                            if ( input === null ) { return; }
                            input.value = '';
                            input.click();
                        }}>
                            <Icon slot="icon" svg={icons.download} />
                            {t('1pImport')}
                        </OutlinedButton>
                        <OutlinedButton disabled={!state.hasContent} data-tip={t('1pExport')} onClick={() => { actions.exportText(); }}>
                            <Icon slot="icon" svg={icons.upload} />
                            {t('1pExport')}
                        </OutlinedButton>
                        <OutlinedButton disabled={!state.hasContent} data-tip={JSON_TIP} onClick={() => { actions.exportJSON(); }}>
                            <Icon slot="icon" svg={icons.json} />
                            JSON
                        </OutlinedButton>
                        <OutlinedButton disabled={state.checkingDomains} data-tip={CHECK_DOMAINS_TIP} onClick={() => { actions.checkDeadDomains(); }}>
                            {state.checkingDomains
                                ? <CircularProgress slot="icon" indeterminate className="ubv-button-progress" />
                                : <Icon slot="icon" svg={icons.domains} />}
                            Check domains
                        </OutlinedButton>
                    </div>
                </Toolbar>
                <List className="ubv-settings-list" aria-label={t('1pPageName')}>
                    <ListItem
                        className="ubv-setting-row"
                        type="button"
                        data-setting-name="enableMyFilters"
                        onClick={() => { actions.setEnabled(state.enabled === false); }}
                    >
                        <div slot="headline" className="ubv-setting-label">{t('1pEnableMyFiltersLabel')}</div>
                        <div slot="end" className="ubv-setting-end">
                            <Checkbox id="enableMyFilters" checked={state.enabled}
                                aria-label={t('1pEnableMyFiltersLabel')}
                                onClick={stopRowToggle}
                                onChange={ev => { actions.setEnabled((ev.target as HTMLInputElement).checked); }} />
                        </div>
                    </ListItem>
                    <ListItem
                        className={'ubv-setting-row' + (state.enabled ? '' : ' is-disabled')}
                        type="button"
                        disabled={state.enabled === false}
                        data-setting-name="trustMyFilters"
                        onClick={() => { actions.setTrusted(state.trusted === false); }}
                    >
                        <div slot="headline" className="ubv-setting-label">{t('1pTrustMyFiltersLabel')}</div>
                        <div slot="end" className="ubv-setting-end">
                            <Checkbox id="trustMyFilters" checked={state.trusted} disabled={!state.enabled}
                                aria-label={t('1pTrustMyFiltersLabel')}
                                onClick={stopRowToggle}
                                onChange={ev => { actions.setTrusted((ev.target as HTMLInputElement).checked); }} />
                        </div>
                    </ListItem>
                </List>
                {trustActive ? <p className="ubv-notice ubv-notice-warning">{t('1pTrustWarning')}</p> : null}
                {state.importNotice ? <p className="ubv-notice ubv-notice-info" role="status">{state.importNotice}</p> : null}
                {state.domainStatus ? <p className="ubv-notice ubv-notice-info" role="status">{state.domainStatus}</p> : null}
            </Card>

            <Card className="ubv-editor-card" aria-label={t('1pPageName')}>
                <div id="userFilters" ref={host} className="codeMirrorContainer codeMirrorBreakAll cm-theme-override" spellCheck={false}></div>
            </Card>

            <Card className="ubv-sites" aria-labelledby="userFilterSitesTitle">
                <div className="ubv-card-header">
                    <h2 id="userFilterSitesTitle" className="ubv-card-title">{t('1pUserFiltersPerSiteTitle')}</h2>
                </div>
                <p className="ubv-muted">{t('1pUserFiltersPerSiteDescription')}</p>
                <p className="ubv-muted">{t('1pUserFiltersStaleDescription')}</p>
                <form className="ubv-site-form" onSubmit={onSiteSubmit}>
                    <Textfield
                        className="ubv-field"
                        variant="outlined"
                        type="text"
                        placeholder={t('1pUserFiltersPerSitePlaceholder')}
                        aria-label={t('1pUserFiltersPerSiteTitle')}
                        value={siteInput}
                        onInput={ev => { setSiteInput((ev.target as HTMLInputElement).value); }}
                    />
                    <FilledTonalButton type="submit" disabled={state.siteBusy}>
                        <Icon slot="icon" svg={icons.block} />
                        {t('1pUserFiltersPerSiteAdd')}
                    </FilledTonalButton>
                </form>
                {state.sites.length === 0 ? (
                    <p className="ubv-muted">{t('1pUserFiltersPerSiteEmpty')}</p>
                ) : (
                    <ChipSet className="ubv-site-chips" aria-label={t('1pUserFiltersPerSiteTitle')}>
                        {state.sites.map(site => (
                            <InputChip
                                key={site}
                                className="ubv-site-chip"
                                label={site}
                                removeOnly
                                selected
                                aria-label-remove={`${t('1pUserFiltersPerSiteRemove')} ${site}`}
                                data-tip={`${t('1pUserFiltersPerSiteRemove')} ${site}`}
                                onRemove={ev => {
                                    // React owns this node, so keep the chip from
                                    // removing itself out from under the tree.
                                    ev.preventDefault();
                                    actions.removeSite(site);
                                }}
                            />
                        ))}
                    </ChipSet>
                )}
                {state.siteStatus ? <p className="ubv-muted" role="status" aria-live="polite">{state.siteStatus}</p> : null}
            </Card>

            <input ref={filePicker} type="file" name="userFiltersImport" accept="text/plain,.txt" hidden
                onChange={ev => {
                    const file = ev.target.files?.[0];
                    if ( file !== undefined ) { actions.importFile(file); }
                }} />
            <Tooltips />
        </div>
    );
}

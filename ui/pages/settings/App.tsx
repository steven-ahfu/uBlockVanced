import { FilledTonalButton, OutlinedButton } from 'material-expressive-react/button';
import { OutlinedSelect, SelectOption } from 'material-expressive-react/select';
import { Textfield } from 'material-expressive-react/textfield';
import { useRef } from 'react';
import type { MdOutlinedSelect } from '@material/web/select/outlined-select.js';
import { AccentSwatches } from './components/AccentSwatches';
import { DocLink, Section, ToggleRow, stopRowToggle } from './components/Rows';
import { pageIcons } from './icons';
import { Icon } from '../../shared/Icon';
import { ListItem } from '../../shared/ListItem';
import { icons } from '../../shared/icons';
import { Tooltips } from '../../shared/Tooltip';
import { t } from '../../shared/i18n';
import { useSettings } from './useSettings';
import { Card } from '../../shared/Card';
import { Pill, Pills } from '../../shared/Pill';

const WIKI = 'https://github.com/gorhill/uBlock/wiki/';
const THEME_OPTIONS: Array<[ string, string ]> = [ [ 'auto', 'Auto' ], [ 'light', 'Light' ], [ 'dark', 'Dark' ] ];

export function App() {
    const [ state, actions ] = useSettings();
    const restorePicker = useRef<HTMLInputElement>(null);
    const themeSelect = useRef<MdOutlinedSelect>(null);
    const canLeak = state.settings?.canLeakLocalIPAddresses === true;

    // "Block media elements larger than {{input}} KB": the number field sits
    // inside the sentence, as upstream.
    const largeMedia = t('settingsNoLargeMediaPrompt').split('{{input}}');
    const largeMediaLabel = (
        <span className="ubv-inline-sentence">
            {largeMedia[0]}
            <Textfield
                className="ubv-inline-number"
                variant="outlined"
                type="number"
                inputMode="numeric"
                min="0"
                noSpinner
                value={actions.value('largeMediaSize')}
                aria-label={t('settingsLargeMediaSizeLabel')}
                data-tip={t('settingsLargeMediaSizeLabel')}
                disabled={actions.unsupported('largeMediaSize')}
                onClick={stopRowToggle}
                onChange={ev => { actions.setValue('largeMediaSize', (ev.target as HTMLInputElement).value); }}
            />
            {largeMedia[1] ?? ''}
        </span>
    );

    return (
        <div className="ubv-page ubv-settings-page">
            <header className="ubv-page-header">
                <div className="ubv-page-copy">
                    <div className="ubv-eyebrow" translate="no">uBlockVanced</div>
                    <h1 className="ubv-title">{t('settingsPageName')}</h1>
                    <p className="ubv-lead">{t('extShortDesc')}</p>
                </div>
            </header>

            <Section title={t('settingsPageName')}>
                <ToggleRow name="collapseBlocked" label={t('settingsCollapseBlockedPrompt')} actions={actions} />
                <ToggleRow name="showIconBadge" label={t('settingsIconBadgePrompt')} actions={actions} />
                <ToggleRow name="contextMenuEnabled" label={t('settingsContextMenuPrompt')} actions={actions} />
                <ToggleRow name="cloudStorageEnabled" label={t('settingsCloudStorageEnabledPrompt')}
                    doc={WIKI + 'Cloud-storage'} actions={actions} />
            </Section>

            <Section title={t('3pGroupPrivacy')}>
                <ToggleRow name="prefetchingDisabled" label={t('settingsPrefetchingDisabledPrompt')}
                    doc={WIKI + 'Dashboard:-Settings#disable-prefetching'} actions={actions} />
                <ToggleRow name="hyperlinkAuditingDisabled" label={t('settingsHyperlinkAuditingDisabledPrompt')}
                    doc={WIKI + 'Dashboard:-Settings#disable-hyperlink-auditing'} actions={actions} />
                {canLeak ? (
                    <ToggleRow name="webrtcIPAddressHidden" label={t('settingsWebRTCIPAddressHiddenPrompt')}
                        doc={WIKI + 'Prevent-WebRTC-from-leaking-local-IP-address'} docIcon={icons.warning} actions={actions} />
                ) : null}
                <ToggleRow name="noCSPReports" label={t('settingsNoCSPReportsPrompt')}
                    doc={WIKI + 'Dashboard:-Settings#block-csp-reports'} actions={actions} />
                <ToggleRow name="cnameUncloakEnabled" label={t('settingsUncloakCnamePrompt')}
                    doc={WIKI + 'Dashboard:-Settings#uncloak-canonical-names'} actions={actions} />
            </Section>

            <Section title={t('settingsAppearance')}>
                <ListItem
                    className="ubv-setting-row"
                    type="button"
                    disabled={actions.unsupported('uiTheme')}
                    data-setting-name="uiTheme"
                    onClick={() => { themeSelect.current?.showPicker(); }}
                >
                    <div slot="headline" className="ubv-setting-label">{t('settingsThemeLabel')}</div>
                    <div slot="end" className="ubv-setting-end">
                        <OutlinedSelect
                            ref={themeSelect}
                            className="ubv-select"
                            /* The row clips its own overflow, so the menu leaves the flow. */
                            menuPositioning="fixed"
                            value={actions.value('uiTheme')}
                            aria-label={t('settingsThemeLabel')}
                            disabled={actions.unsupported('uiTheme')}
                            onClick={stopRowToggle}
                            onChange={ev => { actions.setValue('uiTheme', (ev.target as HTMLSelectElement).value); }}
                        >
                            {THEME_OPTIONS.map(([ value, label ]) => (
                                <SelectOption key={value} value={value} selected={actions.value('uiTheme') === value}>
                                    <div slot="headline">{label}</div>
                                </SelectOption>
                            ))}
                        </OutlinedSelect>
                    </div>
                </ListItem>
                <ToggleRow name="uiAccentCustom" label={t('settingsThemeAccent0Label')} actions={actions}
                    extra={
                        <AccentSwatches
                            value={actions.value('uiAccentCustom0')}
                            disabled={actions.unsupported('uiAccentCustom0')}
                            onPick={color => { actions.setValue('uiAccentCustom0', color); }}
                        />
                    } />
                <ToggleRow name="colorBlindFriendly" label={t('settingsColorBlindPrompt')} actions={actions} />
                <ToggleRow name="tooltipsDisabled" label={t('settingsTooltipsPrompt')} actions={actions} />
            </Section>

            <Section
                title={t('settingPerSiteSwitchGroup')}
                note={<>{t('settingPerSiteSwitchGroupSynopsis')} <DocLink href={WIKI + 'Per-site-switches'} /></>}
            >
                <ToggleRow name="noCosmeticFiltering" label={t('settingsNoCosmeticFilteringPrompt')}
                    doc={WIKI + 'Per-site-switches#no-cosmetic-filtering'} actions={actions} />
                <ToggleRow name="noLargeMedia" label={largeMediaLabel}
                    doc={WIKI + 'Per-site-switches#no-large-media-elements'} actions={actions} />
                <ToggleRow name="noRemoteFonts" label={t('settingsNoRemoteFontsPrompt')}
                    doc={WIKI + 'Per-site-switches#no-remote-fonts'} actions={actions} />
                <ToggleRow name="noScripting" label={t('settingsNoScriptingPrompt')}
                    doc={WIKI + 'Per-site-switches#no-scripting'} actions={actions} />
            </Section>

            <Section
                title={t('settingsAdvanced')}
                note={<>{t('settingsAdvancedSynopsis')} <DocLink href={WIKI + 'Advanced-user-features'} icon={icons.warning} /></>}
            >
                <ToggleRow name="advancedUserEnabled" label={t('settingsAdvancedUserPrompt')} actions={actions}>
                    {/* https://github.com/uBlockOrigin/uBlock-issues/issues/591 */}
                    <DocLink href="advanced-settings.html" icon={pageIcons.advanced} tip={t('settingsAdvancedUserSettings')}
                        onClick={ev => { self.uBlockDashboard.openOrSelectPage(ev.nativeEvent as MouseEvent); }} />
                </ToggleRow>
            </Section>

            <Card id="localData" className="ubv-data" aria-label={t('aboutBackupDataButton')}>
                <Pills className="ubv-data-meta">
                    <Pill id="storageUsed" label={state.storageText} />
                    {state.lastBackupText ? <Pill id="settingsLastBackupPrompt" label={state.lastBackupText} /> : null}
                    {state.lastRestoreText ? <Pill id="settingsLastRestorePrompt" label={state.lastRestoreText} /> : null}
                </Pills>
                <div className="ubv-actions">
                    <FilledTonalButton id="export" data-tip={t('aboutBackupDataButton')} onClick={() => { actions.backup(); }}>
                        <Icon slot="icon" svg={pageIcons.backup} />
                        {t('aboutBackupDataButton')}
                    </FilledTonalButton>
                    <OutlinedButton id="import" data-tip={t('aboutRestoreDataButton')} onClick={() => {
                        const input = restorePicker.current;
                        if ( input === null ) { return; }
                        input.value = '';
                        input.click();
                    }}>
                        <Icon slot="icon" svg={pageIcons.restore} />
                        {t('aboutRestoreDataButton')}
                    </OutlinedButton>
                    <OutlinedButton id="reset" className="ubv-danger" data-tip={t('aboutResetDataButton')} onClick={() => { actions.reset(); }}>
                        <Icon slot="icon" svg={pageIcons.reset} />
                        {t('aboutResetDataButton')}
                    </OutlinedButton>
                </div>
            </Card>

            <input ref={restorePicker} id="restoreFilePicker" type="file" accept="text/plain,application/json" hidden
                onChange={ev => {
                    const file = ev.target.files?.[0];
                    if ( file !== undefined ) { actions.restoreFile(file); }
                }} />
            <Tooltips />
        </div>
    );
}

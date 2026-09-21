import { FilledButton, FilledTonalButton, OutlinedButton } from 'material-expressive-react/button';
import { List, ListItem } from '../../../shared/ListItem';
import { OutlinedSelect, SelectOption } from 'material-expressive-react/select';
import { Checkbox } from 'material-expressive-react/checkbox';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { Section } from './Section';
import { Toolbar } from 'material-expressive-react';
import { frameLabel } from '../model';
import { icons } from '../../../shared/icons';
import { pageIcons } from '../icons';
import { t } from '../../../shared/i18n';
import type { MouseEvent } from 'react';
import type { ProbeState, ProbeStore } from '../useProbe';

interface Props { state: ProbeState; store: ProbeStore }

// Upstream "Inspection" section: the five action buttons, the frame target
// picker, and the live-highlight switch.
export function InspectCard({ state, store }: Props) {
    const { busy } = state;
    const onRowClick = (ev: MouseEvent<HTMLElement>) => {
        if ( (ev.target as HTMLElement).localName === 'md-checkbox' ) { return; }
        store.setLivePreview(state.livePreview === false);
    };
    return (
        <Section
            id="inspectSection"
            icon={pageIcons.inspect}
            title={t('epSectionInspection')}
            subtitle={t('epSectionInspectionSub')}
        >
            <Toolbar variant="Docked" dockPosition="Top" size="Small" className="ubv-toolbar">
                <div className="ubv-actions" role="group" aria-label={t('epSectionInspection')}>
                    <FilledButton
                        id="btnInspectSelected"
                        disabled={busy.inspect !== undefined}
                        data-tip={t('epBtnInspect')}
                        onClick={() => { void store.inspectSelected(); }}
                    >
                        <Icon slot="icon" svg={pageIcons.inspect} />
                        {busy.inspect ?? t('epBtnInspect')}
                    </FilledButton>
                    <FilledTonalButton
                        id="btnInspectPoint"
                        disabled={busy.pick !== undefined}
                        data-tip={t('epBtnPick')}
                        onClick={() => { void store.inspectPoint(); }}
                    >
                        <Icon slot="icon" svg={pageIcons.pick} />
                        {busy.pick ?? t('epBtnPick')}
                    </FilledTonalButton>
                    <OutlinedButton
                        id="btnScanShadow"
                        disabled={busy.shadow !== undefined}
                        data-tip={t('epBtnScanShadow')}
                        onClick={() => { void store.scanShadow(); }}
                    >
                        <Icon slot="icon" svg={pageIcons.shadow} />
                        {busy.shadow ?? t('epBtnScanShadow')}
                    </OutlinedButton>
                    <OutlinedButton
                        id="btnScanIframes"
                        disabled={busy.iframes !== undefined}
                        data-tip={t('epBtnScanIframes')}
                        onClick={() => { void store.scanIframes(); }}
                    >
                        <Icon slot="icon" svg={pageIcons.iframes} />
                        {busy.iframes ?? t('epBtnScanIframes')}
                    </OutlinedButton>
                    {state.isYouTube ? (
                        <OutlinedButton
                            id="btnYtSweep"
                            disabled={busy.youtube !== undefined}
                            data-tip={t('epBtnYtSweep')}
                            onClick={() => { void store.youtubeSweep(); }}
                        >
                            <Icon slot="icon" svg={pageIcons.youtube} />
                            {busy.youtube ?? t('epBtnYtSweep')}
                        </OutlinedButton>
                    ) : null}
                </div>
            </Toolbar>

            <div className="ep-frame-row">
                <OutlinedSelect
                    id="frameTarget"
                    className="ubv-select ep-frame-select"
                    label={t('epFrameTarget')}
                    value={state.frameUrl}
                    onChange={ev => { store.setFrameUrl((ev.target as HTMLSelectElement).value); }}
                >
                    <SelectOption value="" selected={state.frameUrl === ''}>
                        <div slot="headline">{t('epFrameTopDoc')}</div>
                    </SelectOption>
                    {state.frames.map(frame => (
                        <SelectOption key={frame.src} value={frame.src} selected={state.frameUrl === frame.src}>
                            <div slot="headline">{frameLabel(frame)}</div>
                        </SelectOption>
                    ))}
                </OutlinedSelect>
                <IconButton
                    id="btnRefreshFrames"
                    variant="outline"
                    data-tip={t('epBtnRefreshFrames')}
                    aria-label={t('epBtnRefreshFrames')}
                    onClick={() => { void store.refreshFrames(); }}
                >
                    <Icon svg={icons.refresh} />
                </IconButton>
                <List className="ep-toggle-list">
                    <ListItem type="button" className="ep-toggle-row" onClick={onRowClick}>
                        <Checkbox
                            slot="start"
                            id="chkLivePreview"
                            checked={state.livePreview}
                            onChange={ev => { store.setLivePreview((ev.target as HTMLInputElement).checked); }}
                        />
                        <div slot="headline">{t('epLiveHighlight')}</div>
                    </ListItem>
                </List>
            </div>
        </Section>
    );
}

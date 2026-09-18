// uBlockVanced - the logger's top bar: page selector plus the page-scoped
// tools. Every control is a material-expressive-react component.

import { IconButton } from '../../../shared/IconButton';
import { Icon } from '../../../shared/Icon';
import { OutlinedSelect, SelectOption } from 'material-expressive-react/select';
import { Toolbar } from 'material-expressive-react';
import { loggerIcons } from '../icons';
import type { LoggerActions, LoggerSnapshot } from '../useLogger';
import { t } from '../../../shared/i18n';

const WIKI_URL = 'https://github.com/gorhill/uBlock/wiki/The-logger';

interface Props {
    state: LoggerSnapshot;
    actions: LoggerActions;
    domInspectorOn: boolean;
    onToggleDomInspector(): void;
}

export function TopToolbar({ state, actions, domInspectorOn, onToggleDomInspector }: Props) {
    const tip = (key: string) => state.tooltips ? t(key) : undefined;
    const needDom = state.selectedTabId <= 0;

    const currentTabLabel = (() => {
        const base = t('loggerCurrentTab');
        if ( state.activeTabId === 0 ) { return base; }
        const hit = state.tabOptions.find(([ id ]) => id === state.activeTabId);
        return hit !== undefined ? `${base} / ${hit[1]}` : base;
    })();

    return (
        <Toolbar
            variant="Docked"
            dockPosition="Top"
            size="Small"
            className="permatoolbar ubv-logger-bar"
            role="toolbar"
            aria-label={t('statsPageName')}
        >
            <div className="ubv-logger-bar-main">
                <OutlinedSelect
                    id="pageSelector"
                    className="ubv-field ubv-logger-pages"
                    label={t('loggerPageSelectorLabel')}
                    value={state.pageSelector}
                    onChange={ev => {
                        const value = (ev.target as unknown as { value: string }).value;
                        if ( value !== state.pageSelector ) { actions.selectPage(value); }
                    }}
                >
                    <SelectOption value="0" selected={state.pageSelector === '0'}>
                        <div slot="headline">{t('logAll')}</div>
                    </SelectOption>
                    <SelectOption value="-1" selected={state.pageSelector === '-1'}>
                        <div slot="headline">{t('logBehindTheScene')}</div>
                    </SelectOption>
                    <SelectOption value="_" selected={state.pageSelector === '_'}>
                        <div slot="headline">{currentTabLabel}</div>
                    </SelectOption>
                    {state.tabOptions.map(([ id, title ]) => (
                        <SelectOption key={id} value={`${id}`} selected={state.pageSelector === `${id}`}>
                            <div slot="headline">{title}</div>
                        </SelectOption>
                    ))}
                </OutlinedSelect>

                <IconButton
                    id="refresh"
                    variant="standard"
                    disabled={needDom}
                    data-tip={tip('loggerReloadTip')}
                    aria-label={t('loggerReloadTip')}
                    onClick={ev => {
                        const mouse = ev as unknown as MouseEvent;
                        actions.reloadTab(mouse.ctrlKey || mouse.metaKey || mouse.shiftKey);
                    }}
                >
                    <Icon svg={loggerIcons.refresh} />
                </IconButton>

                <IconButton
                    variant={domInspectorOn ? 'tonal' : 'standard'}
                    disabled={needDom}
                    toggle
                    selected={domInspectorOn}
                    data-tip={tip('loggerDomInspectorTip')}
                    aria-label={t('loggerDomInspectorTip')}
                    onClick={onToggleDomInspector}
                >
                    <Icon svg={loggerIcons.dom} />
                </IconButton>

                <IconButton
                    variant={state.popupTabId !== 0 ? 'tonal' : 'standard'}
                    disabled={needDom}
                    toggle
                    selected={state.popupTabId !== 0}
                    data-tip={tip('loggerPopupPanelTip')}
                    aria-label={t('loggerPopupPanelTip')}
                    onClick={() => { actions.togglePopup(); }}
                >
                    <Icon svg={loggerIcons.popup} />
                </IconButton>
            </div>

            <div className="ubv-logger-bar-end">
                <IconButton
                    variant={state.consoleOn ? 'tonal' : 'standard'}
                    toggle
                    selected={state.consoleOn}
                    data-tip={tip('loggerConsoleTip')}
                    aria-label={t('loggerConsoleTip')}
                    onClick={() => { actions.toggleConsole(); }}
                >
                    <Icon svg={loggerIcons.console} />
                </IconButton>
                <IconButton
                    variant="standard"
                    href={WIKI_URL}
                    target="_blank"
                    data-tip={tip('loggerInfoTip')}
                    aria-label={t('loggerInfoTip')}
                >
                    <Icon svg={loggerIcons.wiki} />
                </IconButton>
            </div>
        </Toolbar>
    );
}

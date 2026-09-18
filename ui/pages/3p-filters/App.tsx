import { LinearProgress } from 'material-expressive-react/progress';
import { GroupCard } from './components/ListRows';
import { ImportCard } from './components/ImportCard';
import { SettingsCard } from './components/SettingsCard';
import { Toolbar } from './components/Toolbar';
import { CloudWidget } from '../../shared/CloudWidget';
import { Tooltips } from '../../shared/Tooltip';
import { t, tf } from '../../shared/i18n';
import { useFilterLists } from './useFilterLists';
import { Card } from '../../shared/Card';
import { Pill, Pills } from '../../shared/Pill';

export function App() {
    const [ state, actions ] = useFilterLists();
    const { details } = state;
    const summary = details === null ? '' : tf('3pListsOfBlockedHostsPrompt', {
        netFilterCount: details.netFilterCount,
        cosmeticFilterCount: details.cosmeticFilterCount,
    });
    return (
        <div className={'ubv-page' + (state.updating ? ' updating' : '') + (state.working ? ' working' : '')}>
            <header className="ubv-page-header">
                <div className="ubv-page-copy">
                    <div className="ubv-eyebrow" translate="no">uBlockVanced</div>
                    <h1 className="ubv-title">{t('3pPageName')}</h1>
                    <p className="ubv-lead" id="listsCatalogSummary">{summary}</p>
                </div>
                <Pills role="status" aria-live="polite" aria-atomic="true">
                    <Pill tone="accent" id="filtersEnabledCount" label={`${state.enabledCount.toLocaleString()} enabled`} />
                    <Pill id="filtersAvailableCount" label={`${state.totalCount.toLocaleString()} available`} />
                </Pills>
            </header>

            <CloudWidget datakey="tpFiltersPane" />

            <Card className="ubv-controls" aria-label={t('3pPageName')}>
                <Toolbar state={state} actions={actions} />
                <SettingsCard state={state} actions={actions} />
                {state.updating || state.working ? <LinearProgress indeterminate className="ubv-progress" /> : null}
            </Card>

            <div id="lists" className={state.searchMatches !== null ? 'searchMode' : undefined}>
                {details === null ? null : state.tree.map(group => (
                    <GroupCard key={group.key} group={group} state={state} actions={actions} />
                ))}
                <ImportCard state={state} actions={actions} />
            </div>
            <Tooltips />
        </div>
    );
}

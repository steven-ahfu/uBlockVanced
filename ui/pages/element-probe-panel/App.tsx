import { PANEL_VERSION, useProbe } from './useProbe';
import { Pill, Pills } from '../../shared/Pill';
import { ProceduralCard, SelectorCard } from './components/SelectorLists';
import { ElementCard } from './components/ElementCard';
import { EmptyState } from './components/EmptyState';
import { FilterCard } from './components/FilterCard';
import { HelpCard } from './components/HelpCard';
import { HistoryCard } from './components/HistoryCard';
import { InspectCard } from './components/InspectCard';
import { LogCard } from './components/LogCard';
import { Overview } from './components/Overview';
import { Tooltips } from '../../shared/Tooltip';
import { frameLabel, overviewOf } from './model';
import { t } from '../../shared/i18n';
import type { PillTone } from '../../shared/Pill';

const STATUS_TONES: Record<string, PillTone> = {
    active: 'accent',
    error: 'error',
    idle: 'neutral',
};

export function App() {
    const [ state, store ] = useProbe();
    const frame = state.frames.find(entry => entry.src === state.frameUrl);
    const overview = overviewOf({
        data: state.data,
        filterText: state.filterText,
        frameCount: state.frames.length,
        frameName: frame !== undefined ? frameLabel(frame) : 'Selected iframe',
        frameUrl: state.frameUrl,
        isHighlighting: state.isHighlighting,
        selectorCount: state.selectors.length,
    });
    const inspected = state.data !== null;
    return (
        <div className="ubv-page ep-page">
            <header className="ubv-page-header">
                <div className="ubv-page-copy">
                    <div className="ubv-eyebrow" translate="no">{t('epBranding')}</div>
                    <h1 className="ubv-title">{t('epTitle')}</h1>
                    <p className="ubv-lead">{t('epSubtitle')}</p>
                </div>
                <Pills role="status" aria-live="polite" aria-atomic="true">
                    <Pill
                        id="statusText"
                        tone={STATUS_TONES[state.status.tone]}
                        label={state.status.text || t('epStatusReady')}
                    />
                    <Pill label={'v' + PANEL_VERSION} />
                </Pills>
            </header>

            <p className="ubv-lead ep-selection" id="selectionSummary">
                {state.selectionSummary || t('epNoElementSelected')}
            </p>

            <Overview overview={overview} />

            <InspectCard state={state} store={store} />

            {inspected && state.data !== null ? <ElementCard data={state.data} /> : null}
            {inspected ? <SelectorCard state={state} store={store} /> : null}
            {inspected && state.procedural.length !== 0 ? <ProceduralCard state={state} store={store} /> : null}
            {inspected ? <FilterCard state={state} store={store} /> : null}

            <HelpCard state={state} store={store} />
            <HistoryCard state={state} store={store} />
            {inspected ? null : <EmptyState />}
            <LogCard state={state} store={store} />

            <Tooltips />
        </div>
    );
}

// uBlockVanced - the logger page.
//
// Layout and ids follow upstream (#inspectors, #netInspector, #domInspector,
// #infoInspector, #popupContainer) so src/css/logger-ui.css keeps driving the
// pane geometry and the row colouring; every control inside them is a
// material-expressive-react component.

import { ConsolePane } from './components/ConsolePane';
import { DomInspector, toggleDomInspector } from './components/DomInspector';
import type { EntryView } from './model';
import { EntryDialog } from './components/EntryDialog';
import { ExportDialog } from './components/ExportDialog';
import { LogTable } from './components/LogTable';
import { NetToolbar } from './components/NetToolbar';
import { SettingsDialog } from './components/SettingsDialog';
import { TopToolbar } from './components/TopToolbar';
import { Tooltips } from '../../shared/Tooltip';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLogger } from './useLogger';

export function App() {
    const [ state, actions ] = useLogger();
    const [ entry, setEntry ] = useState<EntryView | null>(null);
    const [ settingsOpen, setSettingsOpen ] = useState(false);
    const [ exportOpen, setExportOpen ] = useState(false);
    const [ domInspectorOn, setDomInspectorOn ] = useState(false);
    const inspectors = useRef<HTMLDivElement>(null);

    // `dom` is added to #inspectors by the retained inspector module, so these
    // two classes are toggled imperatively rather than through className.
    useEffect(() => {
        const el = inspectors.current;
        if ( el === null ) { return; }
        el.classList.toggle('console', state.consoleOn);
        el.classList.toggle('popupOn', state.popupTabId !== 0);
    }, [ state.consoleOn, state.popupTabId ]);

    const onColumnWidths = useCallback((widths: number[], persist: boolean) => {
        actions.applySettings({ ...state.settings, columnWidths: widths }, persist);
    }, [ actions, state.settings ]);

    const netClasses = [ 'inspector' ];
    if ( state.masterFilter ) { netClasses.push('f'); }
    if ( state.paused ) { netClasses.push('paused'); }
    if ( state.vExpanded ) { netClasses.push('vExpanded'); }

    return (
        <>
            <TopToolbar
                state={state}
                actions={actions}
                domInspectorOn={domInspectorOn}
                onToggleDomInspector={toggleDomInspector}
            />

            <div id="inspectors" ref={inspectors}>
                <DomInspector
                    tooltips={state.tooltips}
                    tabIdOf={actions.tabIdFromPageSelector}
                    onActiveChange={setDomInspectorOn}
                />

                <div id="netInspector" className={netClasses.join(' ')}>
                    <NetToolbar
                        state={state}
                        actions={actions}
                        onOpenExport={() => { setExportOpen(true); }}
                        onOpenSettings={() => { setSettingsOpen(true); }}
                    />
                    <LogTable
                        rows={state.rows}
                        revision={state.revision}
                        settings={state.settings}
                        vExpanded={state.vExpanded}
                        onOpenEntry={setEntry}
                        onColumnWidths={onColumnWidths}
                    />
                </div>

                <ConsolePane state={state} actions={actions} />

                <iframe
                    id="popupContainer"
                    title="uBlockVanced"
                    src={state.popupTabId !== 0
                        ? `popup-fenix.html?portrait=1&tabId=${state.popupTabId}`
                        : undefined}
                />
            </div>

            <EntryDialog view={entry} onClose={() => { setEntry(null); }} />
            <SettingsDialog
                open={settingsOpen}
                settings={state.settings}
                onChange={(next, persist) => { actions.applySettings(next, persist); }}
                onClose={() => { setSettingsOpen(false); }}
            />
            <ExportDialog
                open={exportOpen}
                rows={state.rows}
                onClose={() => { setExportOpen(false); }}
            />
            <Tooltips />
        </>
    );
}

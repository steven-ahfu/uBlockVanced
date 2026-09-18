// uBlockVanced - the logger's console stream (#infoInspector).
//
// Rows are derived from the same entry list the table uses: message-realm
// entries for the selected tab. Upstream's incremental DOM bookkeeping is
// unnecessary once React owns the list.

import { COLUMN_FILTER, COLUMN_TIMESTAMP, type LogEntry, escapeRegexStr } from '../model';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { Textfield } from 'material-expressive-react/textfield';
import { Toolbar } from 'material-expressive-react';
import { loggerIcons } from '../icons';
import type { LoggerActions, LoggerSnapshot } from '../useLogger';
import { t } from '../../../shared/i18n';
import { useMemo, useState } from 'react';

interface Props {
    state: LoggerSnapshot;
    actions: LoggerActions;
}

export function ConsolePane({ state, actions }: Props) {
    const [ query, setQuery ] = useState('');
    const tip = (key: string) => state.tooltips ? t(key) : undefined;

    const rows = useMemo(() => {
        if ( state.consoleOn === false ) { return []; }
        const raw = query.trim();
        let not = false;
        let pattern = raw;
        if ( raw.startsWith('-') && raw.length > 1 ) {
            pattern = raw.slice(1);
            not = true;
        }
        const re = pattern !== '' ? new RegExp(escapeRegexStr(pattern), 'i') : undefined;
        const out: Array<{ entry: LogEntry; text: string }> = [];
        for ( const entry of state.entries ) {
            if ( entry.tabId !== state.selectedTabId ) { continue; }
            if ( entry.realm !== 'message' ) { continue; }
            if ( entry.voided ) { continue; }
            const fields = entry.textContent.split('\x1F');
            const text = [ fields[COLUMN_TIMESTAMP] ?? '', fields[COLUMN_FILTER] ?? '' ].join('\xA0');
            if ( re !== undefined && re.test(text) === not ) { continue; }
            out.push({ entry, text });
        }
        return out;
        // `revision` covers in-place mutation of the shared entry array.
    }, [ query, state.consoleOn, state.entries, state.revision, state.selectedTabId ]);

    return (
        <div id="infoInspector" className="inspector">
            <Toolbar
                variant="Docked"
                dockPosition="Top"
                size="Small"
                className="permatoolbar ubv-logger-bar"
                role="toolbar"
                aria-label={t('loggerConsoleTip')}
            >
                <div className="ubv-logger-bar-main">
                    <IconButton
                        id="clearConsole"
                        variant="standard"
                        disabled={rows.length === 0}
                        data-tip={tip('loggerClearConsoleTip')}
                        aria-label={t('loggerClearConsoleTip')}
                        onClick={() => { actions.clearConsole(rows.map(row => row.entry.id)); }}
                    >
                        <Icon svg={loggerIcons.clear} />
                    </IconButton>
                    <IconButton
                        id="logLevel"
                        variant={state.verbose ? 'tonal' : 'standard'}
                        toggle
                        selected={state.verbose}
                        data-tip={tip('loggerVerboseTip')}
                        aria-label={t('loggerVerboseTip')}
                        onClick={() => { actions.toggleVerbose(); }}
                    >
                        <Icon svg={loggerIcons.verbose} />
                    </IconButton>
                    <Textfield
                        id="loggerConsoleFilter"
                        className="ubv-field ubv-logger-filter"
                        variant="outlined"
                        type="search"
                        placeholder={t('loggerConsoleFilterPrompt')}
                        aria-label={t('loggerConsoleFilterPrompt')}
                        value={query}
                        hasLeadingIcon
                        onInput={ev => { setQuery((ev.target as unknown as { value: string }).value); }}
                    >
                        <Icon slot="leading-icon" svg={loggerIcons.search} />
                    </Textfield>
                </div>
            </Toolbar>
            <div className="vscrollable">
                {rows.map(row => (
                    <div key={row.entry.id} data-id={row.entry.id} data-type={row.entry.type}>
                        {row.text}
                    </div>
                ))}
            </div>
        </div>
    );
}

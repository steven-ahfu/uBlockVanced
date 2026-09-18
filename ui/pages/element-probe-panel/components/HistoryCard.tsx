import { List, ListItem } from '../../../shared/ListItem';
import { Pill, Pills } from '../../../shared/Pill';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { Section } from './Section';
import { Textfield } from 'material-expressive-react/textfield';
import { historyCountLabel } from '../model';
import { icons } from '../../../shared/icons';
import { pageIcons } from '../icons';
import { t } from '../../../shared/i18n';
import type { ProbeState, ProbeStore } from '../useProbe';

interface Props { state: ProbeState; store: ProbeStore }

// Upstream "Filter history": recent saves, each row undo/redo-able and
// copyable. The upstream section was never unhidden; here it always shows.
export function HistoryCard({ state, store }: Props) {
    const query = state.historySearch.trim().toLowerCase();
    const rows = state.history
        .map((entry, index) => ({ entry, index }))
        .filter(row => query === '' || row.entry.filter.toLowerCase().includes(query));
    return (
        <Section
            id="historySection"
            icon={pageIcons.history}
            badge={state.history.length > 0 ? String(state.history.length) : undefined}
            title={t('epSectionHistory')}
            subtitle={t('epSectionHistorySub')}
            meta={(
                <>
                    <Pills>
                        <Pill id="historyCount" label={historyCountLabel(rows.length, state.history.length, query !== '')} />
                    </Pills>
                    <IconButton
                        id="btnClearHistory"
                        variant="outline"
                        className="ep-danger"
                        disabled={state.history.length === 0}
                        data-tip={t('epBtnClearHistory')}
                        aria-label={t('epBtnClearHistory')}
                        onClick={() => { store.clearHistory(); }}
                    >
                        <Icon svg={icons.remove} />
                    </IconButton>
                </>
            )}
        >
            <Textfield
                id="historySearch"
                className="ubv-field"
                variant="outlined"
                type="search"
                spellCheck={false}
                placeholder={t('epHistorySearchPlaceholder')}
                aria-label={t('epSectionHistory')}
                hasLeadingIcon
                value={state.historySearch}
                onInput={ev => { store.setHistorySearch((ev.target as HTMLInputElement).value); }}
            >
                <Icon slot="leading-icon" svg={icons.search} />
            </Textfield>
            {rows.length === 0 ? (
                <p className="ubv-muted ep-empty-note">{t('epHistoryEmpty')}</p>
            ) : (
                <List id="historyList" className="ep-history-list">
                    {rows.map(({ entry, index }) => (
                        <ListItem
                            key={entry.filter}
                            className={'ep-history-item' + (entry.active ? '' : ' undone')}
                        >
                            <div slot="headline" className="ep-code" data-tip={entry.filter}>{entry.filter}</div>
                            <div slot="trailing-supporting-text">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                            <span slot="end" className="ep-row-actions">
                                <IconButton
                                    variant="standard"
                                    data-tip={entry.active ? t('epHistoryUndo') : t('epHistoryRedo')}
                                    aria-label={entry.active ? t('epHistoryUndo') : t('epHistoryRedo')}
                                    onClick={() => {
                                        if ( entry.active ) { void store.undoFilter(index); }
                                        else { void store.reapplyFilter(index); }
                                    }}
                                >
                                    <Icon svg={entry.active ? icons.undo : pageIcons.redo} />
                                </IconButton>
                                <IconButton
                                    variant="standard"
                                    data-tip={t('epBtnCopy')}
                                    aria-label={t('epBtnCopy')}
                                    onClick={() => { store.copyText(entry.filter); }}
                                >
                                    <Icon svg={pageIcons.copy} />
                                </IconButton>
                            </span>
                        </ListItem>
                    ))}
                </List>
            )}
        </Section>
    );
}

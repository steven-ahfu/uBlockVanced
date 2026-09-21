import { List, ListItem } from '../../../shared/ListItem';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { Section } from './Section';
import { icons } from '../../../shared/icons';
import { pageIcons } from '../icons';
import { t } from '../../../shared/i18n';
import { useEffect, useRef } from 'react';
import type { ProbeState, ProbeStore } from '../useProbe';

interface Props { state: ProbeState; store: ProbeStore }

// Upstream "Activity log": the same 120-line rolling pane, scrolled to the
// newest line after every entry.
export function LogCard({ state, store }: Props) {
    const pane = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const node = pane.current;
        if ( node !== null ) { node.scrollTop = node.scrollHeight; }
    }, [ state.log ]);
    return (
        <Section
            id="logSection"
            icon={pageIcons.log}
            badge={state.log.length > 0 ? String(state.log.length) : undefined}
            title={t('epSectionLog')}
            subtitle={t('epSectionLogSub')}
            meta={(
                <IconButton
                    id="btnClearLog"
                    variant="outline"
                    disabled={state.log.length === 0}
                    data-tip={t('epBtnClearLog')}
                    aria-label={t('epBtnClearLog')}
                    onClick={() => { store.clearLog(); }}
                >
                    <Icon svg={icons.eraser} />
                </IconButton>
            )}
        >
            <div ref={pane} className="ep-log" id="log">
                {state.log.length === 0 ? (
                    <p className="ubv-muted ep-empty-note">{t('epLogEmpty')}</p>
                ) : (
                    <List className="ep-log-list">
                        {state.log.map(entry => (
                            <ListItem key={entry.id} className={'ep-log-entry' + (entry.tone ? ' ' + entry.tone : '')}>
                                <div slot="headline" className="ep-code">{entry.text}</div>
                            </ListItem>
                        ))}
                    </List>
                )}
            </div>
        </Section>
    );
}

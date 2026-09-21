import { HELP_ROWS } from '../model';
import { List, ListItem } from '../../../shared/ListItem';
import { Icon } from '../../../shared/Icon';
import { Section } from './Section';
import { TextButton } from 'material-expressive-react/button';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import type { ProbeState, ProbeStore } from '../useProbe';

interface Props { state: ProbeState; store: ProbeStore }

// Upstream "Filter syntax reference": the <details> table, as a card whose
// heading button expands a Material list.
export function HelpCard({ state, store }: Props) {
    const open = state.helpOpen;
    return (
        <Section
            id="helpSection"
            icon={icons.help}
            title={t('epSyntaxRef')}
            meta={(
                <TextButton
                    id="btnToggleHelp"
                    aria-expanded={open}
                    aria-controls="helpList"
                    data-tip={t('epSyntaxRef')}
                    onClick={() => { store.setHelpOpen(open === false); }}
                >
                    <Icon slot="icon" svg={open ? icons.less : icons.more} />
                    {t(open ? 'epHelpHide' : 'epHelpShow')}
                </TextButton>
            )}
        >
            {open ? (
                <>
                    <div className="ep-help-head">
                        <span>{t('epHelpColOperator')}</span>
                        <span>{t('epHelpColUsage')}</span>
                        <span>{t('epHelpColDesc')}</span>
                    </div>
                    <List id="helpList" className="ep-help-list">
                        {HELP_ROWS.map(row => (
                            <ListItem key={row.operator} className="ep-help-row">
                                <div slot="start" className="ep-code ep-help-operator">{row.operator}</div>
                                <div slot="headline" className="ep-code">{row.usage}</div>
                                <div slot="supporting-text">{row.description}</div>
                            </ListItem>
                        ))}
                    </List>
                    <p className="ubv-muted">{t('epSyntaxNote')}</p>
                </>
            ) : null}
        </Section>
    );
}

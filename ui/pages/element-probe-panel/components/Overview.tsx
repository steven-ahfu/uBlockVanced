import { Card } from '../../../shared/Card';
import { Icon } from '../../../shared/Icon';
import { icons } from '../../../shared/icons';
import { pageIcons } from '../icons';
import { t } from '../../../shared/i18n';
import type { Overview as OverviewCopy } from '../model';

interface Props { overview: OverviewCopy }

// The three workflow cards under the title (upstream .panel-overview).
export function Overview({ overview }: Props) {
    const cards = [
        { copy: overview.target, icon: pageIcons.target, key: 'epOverviewTarget' },
        { copy: overview.selection, icon: pageIcons.pick, key: 'epOverviewSelection' },
        { copy: overview.output, icon: icons.filter, key: 'epOverviewOutput' },
    ];
    return (
        <div className="ep-overview" aria-label="Workflow summary">
            {cards.map(card => (
                <Card key={card.key} className="ep-overview-card">
                    <div className="ep-overview-head">
                        <Icon svg={card.icon} />
                        <span className="ep-overview-label">{t(card.key)}</span>
                    </div>
                    <strong className="ep-overview-value">{card.copy.value}</strong>
                    <span className="ep-overview-hint">{card.copy.hint}</span>
                </Card>
            ))}
        </div>
    );
}

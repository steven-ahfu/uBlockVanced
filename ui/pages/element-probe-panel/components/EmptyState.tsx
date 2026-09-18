import { Card } from '../../../shared/Card';
import { Icon } from '../../../shared/Icon';
import { pageIcons } from '../icons';
import { t } from '../../../shared/i18n';

// Shown until the first element is inspected (upstream #emptyState).
export function EmptyState() {
    return (
        <Card id="emptyState" className="ep-empty">
            <Icon svg={pageIcons.inspect} className="ep-empty-icon" />
            <p className="ep-empty-main">{t('epEmptyStateMain')}</p>
            <p className="ubv-muted">{t('epEmptyStateHint1')}</p>
            <p className="ubv-muted">{t('epEmptyStateHint2')}</p>
        </Card>
    );
}

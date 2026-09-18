import { t } from '../../shared/i18n';
import { Card } from '../../shared/Card';

const TITLE = 'Dashboard unavailable';

// Shown instead of the dashboard when an administrator policy removes it.
export function App() {
    return (
        <div className="ubv-page ubv-restricted">
            <Card className="ubv-restricted-card" aria-labelledby="restrictedTitle">
                <div className="ubv-restricted-mark" aria-hidden="true">
                    <img src="img/ublock.svg" alt="" />
                </div>
                <div className="ubv-eyebrow" translate="no">{t('extName')}</div>
                <h1 id="restrictedTitle" className="ubv-title">{TITLE}</h1>
                <p className="ubv-notice ubv-notice-warning">{t('noDashboardNotice')}</p>
                <p className="ubv-muted">{t('extShortDesc')}</p>
            </Card>
        </div>
    );
}

import { Pill, Pills } from '../../../shared/Pill';
import { Icon } from '../../../shared/Icon';
import { Section } from './Section';
import { elementRows } from '../model';
import { pageIcons } from '../icons';
import { t } from '../../../shared/i18n';
import type { InspectedData } from '../model';

interface Props { data: InspectedData }

// Upstream "Element details": the label/value grid plus the shadow-DOM badge.
export function ElementCard({ data }: Props) {
    const shadow = data.inShadowDOM
        ? { label: data.shadowClosed ? 'Closed Shadow DOM' : 'Shadow DOM', host: 'Host: ' + (data.shadowHost || 'unknown') }
        : null;
    return (
        <Section
            id="elementSection"
            icon={pageIcons.element}
            title={t('epSectionElement')}
            subtitle={t('epSectionElementSub')}
            meta={shadow !== null ? (
                <Pills>
                    <Pill
                        id="shadowBadge"
                        tone="warning"
                        label={shadow.label}
                        data-tip={shadow.host}
                        icon={<Icon svg={pageIcons.shadowBadge} />}
                    />
                </Pills>
            ) : undefined}
        >
            <div className="ep-element-info" id="elementInfo">
                {elementRows(data).map(row => (
                    <div key={row.key} className="ep-element-row">
                        <span className="ep-element-label">{t(row.key)}</span>
                        <span className={'ep-element-value ep-value-' + row.kind}>{row.value}</span>
                    </div>
                ))}
            </div>
        </Section>
    );
}

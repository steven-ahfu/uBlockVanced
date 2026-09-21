import { Badge } from 'material-expressive-react/badge';
import { Card } from '../../../shared/Card';
import { Icon } from '../../../shared/Icon';
import type { ReactNode } from 'react';

interface SectionProps {
    /** Count shown over the section glyph (md-badge, large variant). */
    badge?: string;
    children: ReactNode;
    className?: string;
    icon: string;
    id?: string;
    /** Pills or buttons pinned to the right of the heading. */
    meta?: ReactNode;
    subtitle?: string;
    title: string;
}

// One panel section: the fork's outlined card with the upstream heading,
// subtitle and right-hand meta slot.
export function Section({ badge, children, className, icon, id, meta, subtitle, title }: SectionProps) {
    return (
        <Card id={id} className={'ep-section' + (className ? ' ' + className : '')}>
            <div className="ubv-card-header ep-heading">
                <span className="ep-heading-icon">
                    <Icon svg={icon} />
                    {badge !== undefined ? <Badge className="ubv-badge" value={badge} /> : null}
                </span>
                <div className="ep-heading-copy">
                    <h2 className="ubv-card-title">{title}</h2>
                    {subtitle ? <p className="ubv-muted">{subtitle}</p> : null}
                </div>
                {meta ? <div className="ep-heading-meta">{meta}</div> : null}
            </div>
            {children}
        </Card>
    );
}

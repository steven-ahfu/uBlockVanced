import { Card as MdCard } from 'material-expressive-react';
import type { CardProps as MdCardProps, CardRef } from 'material-expressive-react/card';
import { forwardRef } from 'react';

export type CardProps = Omit<MdCardProps, 'variant'>;

// The fork's page card: an M3 outlined card (md-outlined-card) carrying the
// `ubv-card` class, so page.css sizes it with --ubv-* tokens and pages can
// add their own layout class. Static by default (no ripple): cards here are
// surfaces, not buttons.
export const Card = forwardRef<CardRef, CardProps>(function Card(
    { className, disableRipple = true, ...props },
    ref,
) {
    return (
        <MdCard
            ref={ref}
            variant="outlined"
            className={'ubv-card' + (className ? ' ' + className : '')}
            disableRipple={disableRipple}
            {...props}
        />
    );
});

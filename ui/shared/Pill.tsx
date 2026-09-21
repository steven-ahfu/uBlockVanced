import { AssistChip, ChipSet } from 'material-expressive-react/chips';
import type { ChipSetProps } from 'material-expressive-react/chips';
import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'accent' | 'warning' | 'error' | 'running';

interface PillProps {
    /** The text on the pill. Chips take a string label, not children. */
    label: string;
    tone?: PillTone;
    id?: string;
    className?: string;
    /** Optional leading glyph or progress indicator, placed in the icon slot. */
    icon?: ReactNode;
    role?: string;
    'aria-live'?: 'off' | 'polite' | 'assertive';
    'data-tip'?: string;
}

// A status pill: an M3 assist chip (md-assist-chip, elevated) that is
// disabled so it reads as a label, not a button. page.css sets the disabled
// opacity tokens back to 1 and paints each tone from the palette.
export function Pill({ label, tone = 'neutral', id, className, icon, ...rest }: PillProps) {
    return (
        <AssistChip
            id={id}
            className={'ubv-pill ubv-pill-' + tone + (className ? ' ' + className : '')}
            label={label}
            elevated
            disabled
            {...rest}
        >
            {icon ? <span slot="icon" className="ubv-pill-icon">{icon}</span> : null}
        </AssistChip>
    );
}

// A row of pills: an M3 chip set (md-chip-set) so the pills wrap and space
// themselves the Material way.
export function Pills({ className, ...props }: ChipSetProps) {
    return <ChipSet className={'ubv-pills' + (className ? ' ' + className : '')} {...props} />;
}

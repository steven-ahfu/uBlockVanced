import { IconButton as MdIconButton } from 'material-expressive-react/icon-button';
import type { IconButtonProps as MdIconButtonProps, IconButtonRef } from 'material-expressive-react/icon-button';
import { forwardRef } from 'react';
import { iconButtonCompactStyle, iconButtonStyle } from './metrics';

export interface IconButtonProps extends Omit<MdIconButtonProps, 'size' | 'type' | 'width'> {
    /** Smaller box (--ubv-control-sm) for a dense row, e.g. the firewall matrix. */
    compact?: boolean;
}

// The fork's icon button: one size (--ubv-control, or --ubv-control-sm when
// compact) and one shape (--ubv-radius-chip) everywhere, so the host box is
// the hover box. Pages pick a `variant`; they never pick a pixel size.
export const IconButton = forwardRef<IconButtonRef, IconButtonProps>(function IconButton(
    { className, compact, style, ...props },
    ref,
) {
    const base = compact ? iconButtonCompactStyle : iconButtonStyle;
    return (
        <MdIconButton
            ref={ref}
            className={'ubv-icon-button' + (compact ? ' ubv-icon-button-sm' : '') + (className ? ' ' + className : '')}
            style={style ? { ...base, ...style } : base}
            {...props}
        />
    );
});

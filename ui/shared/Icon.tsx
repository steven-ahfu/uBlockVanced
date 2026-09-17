import { Icon as MdIcon } from 'material-expressive-react/icon';
import type { CSSProperties } from 'react';

interface IconProps {
    /** SVG markup, imported from @material-symbols/svg-400 (see icons.ts). */
    svg: string;
    /** Named slot, usually "icon" when placed inside a button. */
    slot?: string;
    className?: string;
    style?: CSSProperties;
    /** Decorative by default; pass a label to expose it to assistive tech. */
    label?: string;
}

// Material Symbols as inline SVG inside <md-icon>: no icon font, so nothing
// is fetched at runtime and the CSP stays `script-src 'self'`.
export function Icon({ svg, slot, className, style, label }: IconProps) {
    return (
        <MdIcon
            slot={slot}
            className={className}
            style={style}
            aria-hidden={label ? undefined : true}
            aria-label={label}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

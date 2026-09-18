import { FilledTonalButton, ToggleButton } from 'material-expressive-react/button';
import type { MouseEvent, ReactNode } from 'react';
import { Icon } from './Icon';
import { toggleTileStyle } from './metrics';
import { Badge } from 'material-expressive-react/badge';

interface TileBodyProps {
    icon: string;
    caption: ReactNode;
    badge?: string;
}

// Stacked icon + caption used by every ribbon tile in the app.
export function TileBody({ icon, caption, badge }: TileBodyProps) {
    return (
        <span className="ubv-tile-body">
            <span className="ubv-tile-icon">
                <Icon svg={icon} />
                {badge ? <Badge className="ubv-badge" value={badge} /> : null}
            </span>
            <span className="caption">{caption}</span>
        </span>
    );
}

interface CommonTileProps extends TileBodyProps {
    id?: string;
    className?: string;
    title?: string;
    ariaLabel?: string;
    disabled?: boolean;
    onClick?: (ev: MouseEvent<HTMLElement>) => void;
    onMouseEnter?: () => void;
}

// Tiles are --ubv-tile tall and --ubv-radius-control round (tokens.css);
// controls.css remaps the Material colour tokens on the host for rest,
// hover and selected states so the library components keep their markup.

// An M3 tonal action tile (element picker, logger, dashboard, ...).
export function ActionTile({ id, className, title, ariaLabel, disabled, onClick, onMouseEnter, ...body }: CommonTileProps) {
    return (
        <FilledTonalButton
            id={id}
            className={'ubv-tile ubv-tile-action' + (className ? ' ' + className : '')}
            disabled={disabled}
            data-tip={title}
            aria-label={ariaLabel}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
        >
            <TileBody {...body} />
        </FilledTonalButton>
    );
}

interface ToggleTileProps extends CommonTileProps {
    selected: boolean;
}

// An M3E tonal toggle tile: muted at rest, primary-container and a tighter
// radius when selected. ToggleButton writes its geometry inline, so the
// tokens come in through `style` (ui/shared/metrics.ts).
export function ToggleTile({ id, className, title, ariaLabel, disabled, selected, onClick, onMouseEnter, ...body }: ToggleTileProps) {
    return (
        <ToggleButton
            id={id}
            className={'ubv-tile ubv-tile-toggle' + (selected ? ' on' : '') + (className ? ' ' + className : '')}
            variant="tonal"
            shape="square"
            selected={selected}
            disabled={disabled}
            style={toggleTileStyle(selected)}
            data-tip={title}
            aria-label={ariaLabel}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
        >
            <TileBody {...body} />
        </ToggleButton>
    );
}

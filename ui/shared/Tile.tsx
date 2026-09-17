import { FilledTonalButton, ToggleButton } from 'material-expressive-react/button';
import type { MouseEvent, ReactNode } from 'react';
import { Icon } from './Icon';

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
                {badge ? <span className="ubv-badge">{badge}</span> : null}
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

// A tonal M3 action tile (element picker, logger, dashboard, ...).
export function ActionTile({ id, className, title, ariaLabel, disabled, onClick, onMouseEnter, ...body }: CommonTileProps) {
    return (
        <FilledTonalButton
            id={id}
            className={'ubv-tool' + (className ? ' ' + className : '')}
            disabled={disabled}
            title={title}
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

// A tonal M3E toggle tile: square at rest, rounder and filled when selected.
export function ToggleTile({ id, className, title, ariaLabel, disabled, selected, onClick, onMouseEnter, ...body }: ToggleTileProps) {
    return (
        <ToggleButton
            id={id}
            className={'ubv-tile' + (selected ? ' on' : '') + (className ? ' ' + className : '')}
            variant="tonal"
            shape="square"
            size="medium"
            selected={selected}
            disabled={disabled}
            title={title}
            aria-label={ariaLabel}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
        >
            <TileBody {...body} />
        </ToggleButton>
    );
}

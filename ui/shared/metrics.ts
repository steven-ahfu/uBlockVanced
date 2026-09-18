import type { CSSProperties } from 'react';

// Geometry for Material controls whose React wrapper writes inline styles
// (material-expressive-react derives them from `size` / `shape` props).
// Inline wins over any stylesheet, so the only way to size those controls
// from tokens.css is to hand the wrapper the tokens as its inline values.
// Everything here points at --ubv-* in tokens.css; nothing is a number.

const control = 'var(--ubv-control)';
const icon = 'var(--ubv-icon)';
const shape = 'var(--ubv-radius-chip)';

// The compact box, for an icon button inside a dense row such as the popup's
// firewall matrix. Same shape and the same "host box is the hover box" rule,
// only smaller; it is still one token, not a per-page pixel value.
const controlSm = 'var(--ubv-control-sm)';
const iconSm = '18px';

// One square box for every icon button variant: state layer (standard)
// and container (filled / tonal / outlined) are the same box as the host.
export const iconButtonStyle = {
    '--md-icon-button-state-layer-height': control,
    '--md-icon-button-state-layer-width': control,
    '--md-icon-button-state-layer-shape': shape,
    '--md-icon-button-icon-size': icon,
    '--md-filled-icon-button-container-height': control,
    '--md-filled-icon-button-container-width': control,
    '--md-filled-icon-button-container-shape': shape,
    '--md-filled-icon-button-icon-size': icon,
    '--md-filled-tonal-icon-button-container-height': control,
    '--md-filled-tonal-icon-button-container-width': control,
    '--md-filled-tonal-icon-button-container-shape': shape,
    '--md-filled-tonal-icon-button-icon-size': icon,
    '--md-outlined-icon-button-container-height': control,
    '--md-outlined-icon-button-container-width': control,
    '--md-outlined-icon-button-container-shape': shape,
    '--md-outlined-icon-button-icon-size': icon,
} as CSSProperties;

export const iconButtonCompactStyle = {
    '--md-icon-button-state-layer-height': controlSm,
    '--md-icon-button-state-layer-width': controlSm,
    '--md-icon-button-state-layer-shape': shape,
    '--md-icon-button-icon-size': iconSm,
    '--md-filled-icon-button-container-height': controlSm,
    '--md-filled-icon-button-container-width': controlSm,
    '--md-filled-icon-button-container-shape': shape,
    '--md-filled-icon-button-icon-size': iconSm,
    '--md-filled-tonal-icon-button-container-height': controlSm,
    '--md-filled-tonal-icon-button-container-width': controlSm,
    '--md-filled-tonal-icon-button-container-shape': shape,
    '--md-filled-tonal-icon-button-icon-size': iconSm,
    '--md-outlined-icon-button-container-height': controlSm,
    '--md-outlined-icon-button-container-width': controlSm,
    '--md-outlined-icon-button-container-shape': shape,
    '--md-outlined-icon-button-icon-size': iconSm,
} as CSSProperties;

// ToggleButton writes height, padding, radius, border and colours inline
// (colours as var(--md-sys-color-*) references, which controls.css remaps
// per state on the host). Shape follows M3E: control radius at rest, chip
// radius when selected. The transition adds background so the remap fades.
const toggleTransition = [
    'background-color var(--transition-fast)',
    'border-color var(--transition-fast)',
    'border-radius var(--transition-normal)',
    'box-shadow var(--transition-fast)',
    'color var(--transition-fast)',
].join(', ');

// A ribbon tile: icon over caption, --ubv-tile tall, full cell width.
export const toggleTileStyle = (selected: boolean): CSSProperties => ({
    borderColor: selected ? 'var(--ubv-selected-outline)' : 'var(--md-sys-color-outline-variant)',
    borderRadius: selected ? 'var(--ubv-radius-chip)' : 'var(--ubv-radius-control)',
    flexDirection: 'column',
    height: 'var(--ubv-tile)',
    paddingInline: '3px',
    transition: toggleTransition,
    width: '100%',
});

// The popup power control: --ubv-power tall, fills its grid column; the
// radius loosens when the site is off.
export const powerStyle = (on: boolean): CSSProperties => ({
    borderColor: on ? 'var(--ubv-selected-outline)' : 'var(--md-sys-color-outline-variant)',
    borderRadius: on ? 'var(--ubv-radius-control)' : 'var(--ubv-radius-card)',
    height: 'var(--ubv-power)',
    paddingInline: '16px',
    transition: toggleTransition,
    width: '100%',
});

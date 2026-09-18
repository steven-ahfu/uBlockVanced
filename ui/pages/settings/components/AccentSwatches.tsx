import { AssistChip, ChipSet, FilterChip } from 'material-expressive-react/chips';
import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { t, tf } from '../../../shared/i18n';

// Same preset swatches as the upstream <datalist> (h: 0..360 step 40, S:90, Luv:60).
export const ACCENT_PRESETS = [
    '#f75782', '#cc7f2b', '#9c932b', '#56a22b', '#2ea283',
    '#309fa6', '#3498d6', '#ad75f4', '#f542d6', '#919191',
];

// Readable ink over a swatch: the sRGB relative-luminance rule.
function inkFor(hex: string): string {
    const n = Number.parseInt(hex.slice(1), 16);
    const channel = (v: number): number => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const luminance = 0.2126 * channel((n >> 16) & 255)
        + 0.7152 * channel((n >> 8) & 255)
        + 0.0722 * channel(n & 255);
    return luminance > 0.42 ? '#000000' : '#ffffff';
}

// Paint one chip with its own colour through the chip's own design tokens, so
// the component stays a Material chip and only its palette slots change.
function swatchStyle(color: string): CSSProperties {
    const ink = inkFor(color);
    return {
        '--md-filter-chip-container-color': color,
        '--md-filter-chip-selected-container-color': color,
        '--md-filter-chip-label-text-color': ink,
        '--md-filter-chip-selected-label-text-color': ink,
        '--md-filter-chip-hover-label-text-color': ink,
        '--md-filter-chip-selected-hover-label-text-color': ink,
        '--md-filter-chip-pressed-label-text-color': ink,
        '--md-filter-chip-selected-pressed-label-text-color': ink,
        '--md-filter-chip-selected-leading-icon-color': ink,
        '--md-filter-chip-selected-hover-leading-icon-color': ink,
        '--md-filter-chip-outline-color': 'transparent',
        '--md-filter-chip-selected-outline-width': '0px',
        '--md-filter-chip-hover-state-layer-color': ink,
        '--md-filter-chip-pressed-state-layer-color': ink,
    } as CSSProperties;
}

interface Props {
    /** The current accent colour, as a lowercase #rrggbb string. */
    value: string;
    disabled: boolean;
    onPick(color: string): void;
}

// The accent colour as a chip set: one filter chip per preset, plus a chip
// that hands over to the platform colour picker (Material has none).
export function AccentSwatches({ value, disabled, onPick }: Props) {
    const picker = useRef<HTMLInputElement>(null);
    const current = (value || '#919191').toLowerCase();
    const isCustom = ACCENT_PRESETS.includes(current) === false;
    return (
        <>
            <ChipSet className="ubv-accent-chips" aria-label={t('settingsAccentPresetsLabel')}>
                {ACCENT_PRESETS.map(color => (
                    <FilterChip
                        key={color}
                        className="ubv-accent-chip"
                        label={color}
                        selected={current === color}
                        disabled={disabled}
                        style={swatchStyle(color)}
                        aria-label={tf('settingsAccentPickLabel', { color })}
                        data-tip={color}
                        onClick={() => { onPick(color); }}
                    />
                ))}
                <AssistChip
                    className={'ubv-accent-custom' + (isCustom ? ' selected' : '')}
                    label={t('settingsAccentCustomLabel')}
                    disabled={disabled}
                    style={isCustom ? { '--md-assist-chip-outline-color': current } as CSSProperties : undefined}
                    aria-label={t('settingsThemeAccentColorLabel')}
                    data-tip={t('settingsThemeAccentColorLabel')}
                    onClick={() => { picker.current?.click(); }}
                />
            </ChipSet>
            {/* Material has no colour picker; the native one stays, off-screen,
                and the "Custom…" chip is what the user actually clicks. */}
            <input
                ref={picker}
                className="ubv-color"
                type="color"
                name="uiAccentCustom0"
                value={current}
                tabIndex={-1}
                aria-hidden="true"
                disabled={disabled}
                onChange={ev => { onPick(ev.target.value); }}
            />
        </>
    );
}

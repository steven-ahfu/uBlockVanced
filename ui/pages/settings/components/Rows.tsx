import { Switch } from 'material-expressive-react/switch';
import type { ReactNode } from 'react';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { List, ListItem } from '../../../shared/ListItem';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import { Card } from '../../../shared/Card';
import type { SettingsActions } from '../useSettings';

// The row itself is the toggle, so a control sitting in one of its slots must
// swallow its own click instead of letting it reach the row.
export const stopRowToggle = (ev: React.MouseEvent): void => { ev.stopPropagation(); };

interface DocLinkProps { href: string; tip?: string; icon?: string; onClick?: (ev: React.MouseEvent) => void }

// The "open documentation" glyph next to a setting.
export function DocLink({ href, tip, icon, onClick }: DocLinkProps) {
    const label = tip ?? t('genericOpenDocumentation');
    return (
        <IconButton variant="standard" className="ubv-doc" href={href} target="_blank"
            rel="noopener noreferrer" data-tip={label} aria-label={label}
            onClick={ev => { ev.stopPropagation(); onClick?.(ev); }}>
            <Icon svg={icon ?? icons.info} />
        </IconButton>
    );
}

interface ToggleRowProps {
    name: string;
    label: ReactNode;
    tip?: string;
    doc?: string;
    docIcon?: string;
    actions: SettingsActions;
    /** Controls that sit beside the switch, in the row's end slot. */
    children?: ReactNode;
    /** Wide content (a chip set, a picker) under the label. */
    extra?: ReactNode;
}

// One on/off user setting as a Material list row: the row is the button, the
// switch mirrors its state. A setting the background does not report (or a
// capability the platform lacks) renders disabled.
export function ToggleRow({ name, label, tip, doc, docIcon, actions, children, extra }: ToggleRowProps) {
    const disabled = actions.disabled(name);
    const id = `setting-${name}`;
    const on = actions.bool(name);
    return (
        <ListItem
            className={'ubv-setting-row' + (disabled ? ' is-disabled' : '')}
            type="button"
            disabled={disabled}
            data-setting-name={name}
            data-tip={tip}
            onClick={() => { actions.setBool(name, !on); }}
        >
            <div slot="headline" className="ubv-setting-label">{label}</div>
            {extra !== undefined ? (
                <div slot="supporting-text" className="ubv-setting-extra" onClick={stopRowToggle}>{extra}</div>
            ) : null}
            <div slot="end" className="ubv-setting-end">
                {children}
                {doc ? <DocLink href={doc} icon={docIcon} /> : null}
                <Switch
                    id={id}
                    selected={on}
                    disabled={disabled}
                    aria-label={typeof label === 'string' ? label : name}
                    onClick={stopRowToggle}
                    onChange={ev => { actions.setBool(name, (ev.target as HTMLInputElement & { selected: boolean }).selected); }}
                />
            </div>
        </ListItem>
    );
}

interface SectionProps { title: string; note?: ReactNode; children: ReactNode; className?: string }

export function Section({ title, note, children, className }: SectionProps) {
    return (
        <Card className={'ubv-section' + (className ? ' ' + className : '')} aria-label={title}>
            <div className="ubv-card-header">
                <h2 className="ubv-card-title">{title}</h2>
            </div>
            {note ? <p className="ubv-muted ubv-section-note">{note}</p> : null}
            <List className="ubv-section-rows" aria-label={title}>{children}</List>
        </Card>
    );
}

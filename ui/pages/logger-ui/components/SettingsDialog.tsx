// uBlockVanced - logger settings.
//
// Same three discard limits, the same hidden-column set and the same
// lines-per-entry value upstream stores under `loggerSettings`; the controls
// are Material text fields and switches instead of bare number/checkbox
// inputs. Changes apply live and are written back when the dialog closes.

import {
    COLUMN_FILTER,
    COLUMN_INITIATOR,
    COLUMN_PARTYNESS,
    COLUMN_TIMESTAMP,
    type LoggerSettings,
    clampNumber,
} from '../model';
import { Dialog } from 'material-expressive-react/dialog';
import { Switch } from 'material-expressive-react/switch';
import { TextButton } from 'material-expressive-react/button';
import { Textfield } from 'material-expressive-react/textfield';
import type { ReactNode } from 'react';
import { t } from '../../../shared/i18n';

interface Props {
    open: boolean;
    settings: LoggerSettings;
    onChange(next: LoggerSettings, persist: boolean): void;
    onClose(): void;
}

const HIDEABLE_COLUMNS: Array<[ number, string ]> = [
    [ COLUMN_TIMESTAMP, 'loggerSettingHideColumnTime' ],
    [ COLUMN_FILTER, 'loggerSettingHideColumnFilter' ],
    [ COLUMN_INITIATOR, 'loggerSettingHideColumnContext' ],
    [ COLUMN_PARTYNESS, 'loggerSettingHideColumnPartyness' ],
];

const plainLabel = (key: string): string => t(key).replace('{{input}}', '').trim();

// The upstream strings wrap the input: "Preserve at most {{input}} entries".
function NumberRow({ i18nKey, value, min, max, step, onCommit }: {
    i18nKey: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onCommit(value: number): void;
}): ReactNode {
    const [ before, after ] = t(i18nKey).split('{{input}}');
    return (
        <label className="ubv-logger-setting">
            <span>{before}</span>
            <Textfield
                className="ubv-field ubv-logger-number"
                variant="outlined"
                type="number"
                min={`${min}`}
                max={`${max}`}
                step={step !== undefined ? `${step}` : undefined}
                value={`${value}`}
                onInput={ev => {
                    const raw = parseInt((ev.target as unknown as { value: string }).value, 10);
                    onCommit(clampNumber(raw, min, max, value));
                }}
            />
            <span>{after ?? ''}</span>
        </label>
    );
}

export function SettingsDialog({ open, settings, onChange, onClose }: Props) {
    const patch = (next: Partial<LoggerSettings>) => {
        onChange({ ...settings, ...next }, false);
    };
    const patchDiscard = (next: Partial<LoggerSettings['discard']>) => {
        onChange({ ...settings, discard: { ...settings.discard, ...next } }, false);
    };

    return (
        <Dialog
            id="loggerSettingsDialog"
            className="ubv-dialog ubv-logger-dialog"
            open={open}
            onClosed={() => { onChange(settings, true); onClose(); }}
            aria-labelledby="loggerSettingsTitle"
        >
            <div slot="headline" id="loggerSettingsTitle">{t('loggerSettingsTip')}</div>
            <div slot="content" className="ubv-logger-dialog-body">
                <section>
                    <p className="ubv-muted">{t('loggerSettingDiscardPrompt')}</p>
                    <NumberRow
                        i18nKey="loggerSettingPerEntryMaxAge"
                        value={settings.discard.maxAge}
                        min={0} max={50000} step={15}
                        onCommit={value => { patchDiscard({ maxAge: value }); }}
                    />
                    <NumberRow
                        i18nKey="loggerSettingPerTabMaxLoads"
                        value={settings.discard.maxLoadCount}
                        min={0} max={1000000}
                        onCommit={value => { patchDiscard({ maxLoadCount: value }); }}
                    />
                    <NumberRow
                        i18nKey="loggerSettingPerTabMaxEntries"
                        value={settings.discard.maxEntryCount}
                        min={0} max={1000000} step={100}
                        onCommit={value => { patchDiscard({ maxEntryCount: value }); }}
                    />
                </section>

                <section>
                    <p className="ubv-muted">{t('loggerSettingHideColumnsPrompt')}</p>
                    {HIDEABLE_COLUMNS.map(([ column, key ]) => (
                        <label className="ubv-logger-setting ubv-logger-toggle" key={column}>
                            <span className="ubv-setting-label">{plainLabel(key)}</span>
                            <Switch
                                selected={settings.columns[column] === false}
                                aria-label={plainLabel(key)}
                                onChange={ev => {
                                    const hidden = (ev.target as unknown as { selected: boolean }).selected;
                                    const columns = settings.columns.slice();
                                    columns[column] = hidden === false;
                                    patch({ columns });
                                }}
                            />
                        </label>
                    ))}
                </section>

                <section>
                    <NumberRow
                        i18nKey="loggerSettingPerEntryLineCount"
                        value={settings.linesPerEntry}
                        min={2} max={6}
                        onCommit={value => { patch({ linesPerEntry: value }); }}
                    />
                </section>
            </div>
            <div slot="actions" className="ubv-dialog-actions">
                <TextButton onClick={onClose}>{t('loggerCloseDialogTip')}</TextButton>
            </div>
        </Dialog>
    );
}

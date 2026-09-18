// uBlockVanced - "export logger output".
//
// The two upstream radio groups (list/table, plain/markdown) are Material
// segmented button sets; the formatter itself is the upstream one, moved to
// model.ts.

import { Dialog } from 'material-expressive-react/dialog';
import { FilledButton, TextButton } from 'material-expressive-react/button';
import { Icon } from '../../../shared/Icon';
import {
    type ExportEncoding,
    type ExportFormat,
    type LogEntry,
    formatExport,
} from '../model';
import { OutlinedSegmentedButton, OutlinedSegmentedButtonSet } from 'material-expressive-react';
import { Textfield } from 'material-expressive-react/textfield';
import { loggerIcons } from '../icons';
import { t } from '../../../shared/i18n';
import { useMemo, useState } from 'react';

interface Props {
    open: boolean;
    rows: LogEntry[];
    onClose(): void;
}

export function ExportDialog({ open, rows, onClose }: Props) {
    const [ format, setFormat ] = useState<ExportFormat>('list');
    const [ encoding, setEncoding ] = useState<ExportEncoding>('markdown');

    const output = useMemo(
        () => open ? formatExport(rows, { format, encoding, time: 'anonymous' }) : '',
        [ encoding, format, open, rows ],
    );

    const copy = () => {
        void navigator.clipboard.writeText(output).catch(() => { });
    };

    return (
        <Dialog
            id="loggerExportDialog"
            className="ubv-dialog ubv-logger-dialog"
            open={open}
            onClosed={onClose}
            aria-labelledby="loggerExportTitle"
        >
            <div slot="headline" id="loggerExportTitle">{t('loggerExportTip')}</div>
            <div slot="content" className="ubv-logger-dialog-body">
                <div className="ubv-logger-export-options">
                    <OutlinedSegmentedButtonSet
                        selectType="single"
                        value={format}
                        aria-label={t('loggerExportFormatList')}
                        onChange={value => { setFormat(value as ExportFormat); }}
                    >
                        <OutlinedSegmentedButton value="list" label={t('loggerExportFormatList')} />
                        <OutlinedSegmentedButton value="table" label={t('loggerExportFormatTable')} />
                    </OutlinedSegmentedButtonSet>
                    <OutlinedSegmentedButtonSet
                        selectType="single"
                        value={encoding}
                        aria-label={t('loggerExportEncodePlain')}
                        onChange={value => { setEncoding(value as ExportEncoding); }}
                    >
                        <OutlinedSegmentedButton value="plain" label={t('loggerExportEncodePlain')} />
                        <OutlinedSegmentedButton value="markdown" label={t('loggerExportEncodeMarkdown')} />
                    </OutlinedSegmentedButtonSet>
                    <FilledButton onClick={copy}>
                        <Icon slot="icon" svg={loggerIcons.copy} />
                        {t('genericCopyToClipboard')}
                    </FilledButton>
                </div>
                <Textfield
                    className="ubv-field ubv-logger-output"
                    variant="outlined"
                    type="textarea"
                    rows={14}
                    readOnly
                    value={output}
                    aria-label={t('loggerExportTip')}
                />
            </div>
            <div slot="actions" className="ubv-dialog-actions">
                <TextButton onClick={onClose}>{t('loggerCloseDialogTip')}</TextButton>
            </div>
        </Dialog>
    );
}

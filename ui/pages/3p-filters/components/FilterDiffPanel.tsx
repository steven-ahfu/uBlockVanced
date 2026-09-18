import { TextButton } from 'material-expressive-react/button';
import { useState } from 'react';
import { Card } from '../../../shared/Card';
import { Icon } from '../../../shared/Icon';
import { Pill, Pills } from '../../../shared/Pill';
import type { PillTone } from '../../../shared/Pill';
import { icons } from '../../../shared/icons';
import { tOr, tf } from '../../../shared/i18n';
import type { FilterListDiff } from '../types';

interface Props { diff: FilterListDiff }

type Section = { cls: string; msg: string; fallback: string; lines: string[] };

// One change set, collapsed behind its own Material toggle.
function DiffSection({ cls, msg, fallback, lines }: Section) {
    const [ open, setOpen ] = useState(true);
    const name = tOr(msg, fallback);
    const tip = tf(open ? '3pDiffSectionCollapse' : '3pDiffSectionExpand', { name });
    return (
        <div className={'ubv-diff-section ' + cls}>
            <TextButton
                className="ubv-diff-section-toggle"
                aria-expanded={open ? 'true' : 'false'}
                data-tip={tip}
                onClick={() => { setOpen(open === false); }}
            >
                <Icon slot="icon" svg={open ? icons.less : icons.more} />
                {name} ({lines.length.toLocaleString()})
            </TextButton>
            {open ? <pre>{lines.join('\n')}</pre> : null}
        </div>
    );
}

// Changes since the previous update of one list: counts, then each change
// set in a collapsible block.
export function FilterDiffPanel({ diff }: Props) {
    const counts: Array<[ string, string, PillTone, number ]> = [
        [ '3pFilterListAdded', 'Added', 'accent', diff.addedCount || 0 ],
        [ '3pFilterListRemoved', 'Removed', 'error', diff.removedCount || 0 ],
        [ '3pFilterListModified', 'Modified', 'warning', diff.modifiedCount || 0 ],
    ];
    const sections: Section[] = [
        { cls: 'added', msg: '3pFilterListAdded', fallback: 'Added', lines: diff.added || [] },
        { cls: 'removed', msg: '3pFilterListRemoved', fallback: 'Removed', lines: diff.removed || [] },
        {
            cls: 'modified',
            msg: '3pFilterListModified',
            fallback: 'Modified',
            lines: (diff.modified || []).map(m => `- ${m.before}\n+ ${m.after}`),
        },
    ];
    return (
        <Card className="ubv-diff" aria-label={tOr('3pFilterListChanges', 'Changes since previous update')}>
            <div className="ubv-diff-heading">{tOr('3pFilterListChanges', 'Changes since previous update')}</div>
            <Pills className="ubv-diff-summary">
                {counts.map(([ key, fallback, tone, count ]) => (
                    <Pill key={key} className={'ubv-diff-count ' + fallback.toLowerCase()} tone={tone}
                        label={`${tOr(key, fallback)} ${count.toLocaleString()}`} />
                ))}
            </Pills>
            {sections.map(section => (
                section.lines.length === 0 ? null : <DiffSection key={section.cls} {...section} />
            ))}
            {diff.truncated ? (
                <p className="ubv-diff-note">
                    {tOr('3pFilterListDiffTruncated', 'Only the first part of each change set is shown.')}
                </p>
            ) : null}
        </Card>
    );
}

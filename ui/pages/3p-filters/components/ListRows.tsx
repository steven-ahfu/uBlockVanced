import { TextButton } from 'material-expressive-react/button';
import { Checkbox } from 'material-expressive-react/checkbox';
import { CircularProgress } from 'material-expressive-react/progress';
import { FilterDiffPanel } from './FilterDiffPanel';
import { withFlags } from '../../../shared/Flags';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { ListItem } from '../../../shared/ListItem';
import { Pill } from '../../../shared/Pill';
import { icons } from '../../../shared/icons';
import { elapsedTimeToString, t, tOr, tf } from '../../../shared/i18n';
import { Card } from '../../../shared/Card';
import { leafStatus, leavesOf, nodeRollup, renderLeafStats } from '../model';
import type { BranchNode, LeafNode, TreeNode } from '../model';
import type { FilterListsActions, FilterListsState } from '../useFilterLists';
import type { ListsetDetails } from '../types';

interface RowsProps { state: FilterListsState; actions: FilterListsActions }

const lastUpdate = (writeTime: number): string =>
    tf('3pLastUpdate', { ago: elapsedTimeToString(writeTime) });

// Whether a subtree has anything to show under the current search.
const visible = (node: TreeNode, matches: ReadonlySet<string> | null): boolean => {
    if ( matches === null ) { return true; }
    return leavesOf(node).some(leaf => matches.has(leaf.key));
};

interface StatusProps { className: string; tip: string; icon: string }

// A non-interactive status glyph with its explanation on hover.
function Status({ className, tip, icon }: StatusProps) {
    return (
        <span className={'ubv-status ' + className} data-tip={tip} aria-label={tip} role="img">
            <Icon svg={icon} />
        </span>
    );
}

interface LinkProps { href: string; tip: string; icon: string; className?: string }

function LinkButton({ href, tip, icon, className }: LinkProps) {
    return (
        <IconButton variant="standard" className={className} href={href} target="_blank"
            data-tip={tip} aria-label={tip}>
            <Icon svg={icon} />
        </IconButton>
    );
}

// A count of enabled lists over available lists, as a status pill.
function CountPill({ checked, total }: { checked: number; total: number }) {
    return (
        <Pill className="ubv-count" label={`${checked.toLocaleString()}/${total.toLocaleString()}`} />
    );
}

// Status + purge controls shared by leaf and node rows.
function CommonStatus({ node, details, state, actions, on, cached, obsolete, recent, writeTime, failed }: {
    node: TreeNode; details: ListsetDetails; state: FilterListsState; actions: FilterListsActions;
    on: boolean; cached: boolean; obsolete: boolean; recent: boolean; writeTime: number; failed: boolean;
}) {
    void details;
    const busy = state.updating || state.working;
    const showUpdating = on && obsolete && (state.updating || (state.working && cached === false));
    return (
        <>
            {on && obsolete && busy === false ? (
                <Status className="ubv-status-obsolete" icon={icons.warning}
                    tip={t('3pExternalListObsolete') + (cached && writeTime !== 0 ? '\n' + lastUpdate(writeTime) : '')} />
            ) : null}
            {on && cached && obsolete === false ? (
                <IconButton variant="standard"
                    className={'ubv-cache' + (recent ? ' recent' : '')}
                    data-tip={lastUpdate(writeTime)} aria-label={lastUpdate(writeTime)}
                    onClick={ev => { actions.purge(node, ev.shiftKey); }}>
                    <Icon svg={icons.clock} />
                </IconButton>
            ) : null}
            {showUpdating ? (
                <CircularProgress indeterminate className="ubv-status-updating"
                    data-tip={t('3pUpdating')} aria-label={t('3pUpdating')} />
            ) : null}
            {failed ? <Status className="ubv-status-failed" icon={icons.failed} tip={t('3pNetworkError')} /> : null}
        </>
    );
}

function LeafRow({ leaf, state, actions }: RowsProps & { leaf: LeafNode }) {
    const details = state.details as ListsetDetails;
    const d = details.available[leaf.key] || leaf.details;
    const status = leafStatus(leaf.key, details, state);
    const removing = state.toRemove.has(leaf.key);
    const diff = details.filterListDiffs?.[leaf.key];
    const hasDiff = diff !== undefined && diff !== null &&
        ((diff.addedCount || 0) !== 0 || (diff.removedCount || 0) !== 0 || (diff.modifiedCount || 0) !== 0);
    const diffOpen = hasDiff && state.openDiffs.has(leaf.key);
    const viewChanges = tOr('3pViewChanges', 'View changes');
    const cls = [ 'ubv-row', 'ubv-row-leaf' ];
    if ( status.on ) { cls.push('checked'); }
    if ( removing ) { cls.push('toRemove'); }
    if ( d.external ) { cls.push('external'); }
    return (
        <div className="ubv-entry" data-key={leaf.key} data-role="leaf">
            <ListItem className={cls.join(' ')} type="text">
                <Checkbox
                    slot="start"
                    className="ubv-row-check"
                    checked={status.on}
                    aria-label={leaf.title}
                    onChange={ev => { actions.toggleLeaf(leaf.key, (ev.target as HTMLInputElement).checked); }}
                />
                <div slot="headline" className="ubv-row-main">
                    <span className="ubv-row-name">{withFlags(leaf.title)}</span>
                    <span className="ubv-row-stats">{renderLeafStats(status.on ? d.entryUsedCount ?? NaN : 0, d.entryCount ?? NaN)}</span>
                </div>
                <div slot="end" className="ubv-row-actions">
                    {hasDiff ? (
                        <TextButton className="ubv-diff-toggle" aria-expanded={diffOpen ? 'true' : 'false'}
                            data-tip={viewChanges} onClick={() => { actions.toggleDiff(leaf.key); }}>
                            <Icon slot="icon" svg={icons.diff} />
                            {viewChanges}
                        </TextButton>
                    ) : null}
                    <LinkButton href={'asset-viewer.html?url=' + encodeURIComponent(leaf.key)} icon={icons.view} tip={t('3pViewContent')} />
                    {d.supportName && d.supportURL ? (
                        <LinkButton href={d.supportURL} icon={icons.home} tip={d.supportName} />
                    ) : null}
                    {d.instructionURL ? (
                        <LinkButton href={d.instructionURL} icon={icons.info} tip={t('3pReadInstructions')} />
                    ) : null}
                    {d.external ? (
                        <IconButton variant="standard" className="ubv-remove"
                            aria-pressed={removing ? 'true' : 'false'}
                            data-tip={t('3pRemoveExternalList')} aria-label={t('3pRemoveExternalList')}
                            onClick={() => { actions.toggleRemove(leaf.key); }}>
                            <Icon svg={icons.remove} />
                        </IconButton>
                    ) : null}
                    {status.on && status.unsecure ? <Status className="ubv-status-unsecure" icon={icons.unsecure} tip="http" /> : null}
                    <CommonStatus node={leaf} details={details} state={state} actions={actions}
                        on={status.on} cached={status.cached} obsolete={status.obsolete} recent={status.recent}
                        writeTime={status.writeTime} failed={status.failed} />
                </div>
            </ListItem>
            {diffOpen && diff ? <FilterDiffPanel diff={diff} /> : null}
        </div>
    );
}

function BranchRow({ node, state, actions }: RowsProps & { node: BranchNode }) {
    const details = state.details as ListsetDetails;
    const r = nodeRollup(node, details, state);
    const on = r.checkedCount !== 0;
    const partial = on && r.checkedCount !== r.leafCount;
    const first = r.first;
    const firstDetails = first ? (details.available[first.key] || first.details) : null;
    const recent = r.cached && Date.now() - r.oldestWriteTime < 60 * 60 * 1000;
    return (
        <div className={'ubv-entry ubv-entry-node' + (node.preferred ? ' preferred' : '')} data-key={node.key} data-role="node">
            <ListItem className={'ubv-row ubv-row-node' + (on ? ' checked' : '')} type="text">
                <Checkbox
                    slot="start"
                    className="ubv-row-check"
                    checked={on}
                    indeterminate={partial}
                    aria-label={node.title}
                    onChange={ev => { actions.toggleNode(node, (ev.target as HTMLInputElement).checked); }}
                />
                <div slot="headline" className="ubv-row-main">
                    <span className="ubv-row-name">{withFlags(node.title)}</span>
                    <span className="ubv-row-stats">{renderLeafStats(r.used, r.total)}</span>
                </div>
                <div slot="end" className="ubv-row-end">
                    <CountPill checked={r.checkedCount} total={r.leafCount} />
                    <div className="ubv-row-actions">
                        {firstDetails?.supportName && firstDetails.supportURL ? (
                            <LinkButton href={firstDetails.supportURL} icon={icons.home} tip={firstDetails.supportName} />
                        ) : null}
                        {firstDetails?.instructionURL ? (
                            <LinkButton href={firstDetails.instructionURL} icon={icons.info} tip={t('3pReadInstructions')} />
                        ) : null}
                        <CommonStatus node={node} details={details} state={state} actions={actions}
                            on={on} cached={r.cached} obsolete={r.obsolete} recent={recent}
                            writeTime={r.latestWriteTime} failed={false} />
                    </div>
                </div>
            </ListItem>
            <div className="ubv-children">
                <Rows nodes={node.children} state={state} actions={actions} />
            </div>
        </div>
    );
}

export function Rows({ nodes, state, actions }: RowsProps & { nodes: TreeNode[] }) {
    return (
        <>
            {nodes.map(node => {
                if ( visible(node, state.searchMatches) === false ) { return null; }
                return node.kind === 'leaf'
                    ? <LeafRow key={node.key} leaf={node} state={state} actions={actions} />
                    : <BranchRow key={node.key} node={node} state={state} actions={actions} />;
            })}
        </>
    );
}

// A top-level catalog group as one card.
export function GroupCard({ group, state, actions }: RowsProps & { group: BranchNode }) {
    if ( visible(group, state.searchMatches) === false ) { return null; }
    const r = nodeRollup(group, state.details as ListsetDetails, state);
    return (
        <Card className="ubv-group" data-key={group.key} aria-label={group.title}>
            <header className="ubv-group-header">
                <h2 className="ubv-group-title">{group.title}</h2>
                <CountPill checked={r.checkedCount} total={r.leafCount} />
            </header>
            <div className="ubv-group-body">
                <Rows nodes={group.children} state={state} actions={actions} />
            </div>
        </Card>
    );
}

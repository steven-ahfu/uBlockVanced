// uBlockVanced - the row filterer's built-in expressions.
//
// Upstream draws them as `span[data-filtex]` tokens in a hand-rolled popover;
// here each token is a Material filter chip inside a menu surface, with the
// leading "Not" of every row as its own chip. The expressions themselves and
// their OR/NOT semantics are unchanged (see model.ts).

import { ChipSet, FilterChip } from 'material-expressive-react/chips';
import { FILTEX_GROUPS, type FiltexState } from '../model';
import { MenuSurface } from 'material-expressive-react/menu';
import { TextButton } from 'material-expressive-react/button';
import { t, tOr } from '../../../shared/i18n';
import { useEffect, useRef } from 'react';

interface Props {
    open: boolean;
    state: FiltexState;
    cnameSeen: boolean;
    onToggle(filtex: string): void;
    onToggleNot(groupId: string): void;
    onReset(): void;
    onClose(): void;
}

export function RowFiltererMenu({ open, state, cnameSeen, onToggle, onToggleNot, onReset, onClose }: Props) {
    const host = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if ( open === false ) { return; }
        const onPointerDown = (ev: Event) => {
            const target = ev.target;
            if ( target instanceof Node && host.current?.contains(target) === true ) { return; }
            if ( target instanceof Element && target.closest('#filterExprButton') !== null ) { return; }
            onClose();
        };
        const onKeyDown = (ev: KeyboardEvent) => {
            if ( ev.key === 'Escape' ) { onClose(); }
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [ onClose, open ]);

    if ( open === false ) { return null; }

    return (
        <div className="ubv-filtex-anchor" ref={host}>
            <MenuSurface
                id="filterExprPicker"
                className="ubv-filtex-menu"
                variant="standard"
                scroll
                maxHeight="min(70vh, 520px)"
                role="group"
                aria-label={t('loggerRowFiltererBuiltinTip')}
            >
                {FILTEX_GROUPS.map(group => {
                    if ( group.cnameOnly === true && cnameSeen === false ) { return null; }
                    const negated = state.not.has(group.id);
                    return (
                        <div className="ubv-filtex-group" key={group.id}>
                            <div className="ubv-filtex-label">
                                {tOr(group.i18nKey, group.id)}
                            </div>
                            <ChipSet className="ubv-filtex-chips">
                                <FilterChip
                                    className="ubv-filtex-not"
                                    label={t('loggerRowFiltererBuiltinNot')}
                                    selected={negated}
                                    onClick={() => { onToggleNot(group.id); }}
                                />
                                {group.items.map(item => (
                                    <FilterChip
                                        key={item.filtex}
                                        label={item.i18nKey !== undefined ? t(item.i18nKey) : (item.label ?? '')}
                                        selected={state.on.has(item.filtex)}
                                        onClick={() => { onToggle(item.filtex); }}
                                    />
                                ))}
                            </ChipSet>
                        </div>
                    );
                })}
                <div className="ubv-filtex-footer">
                    <TextButton onClick={() => { onReset(); }}>
                        {tOr('loggerUiFilterReset', 'Reset')}
                    </TextButton>
                </div>
            </MenuSurface>
        </div>
    );
}

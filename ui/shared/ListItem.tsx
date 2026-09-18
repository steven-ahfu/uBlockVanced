import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import type { MdList } from '@material/web/list/list.js';
import type { MdListItem } from '@material/web/list/list-item.js';
import { createElement, forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

// material-expressive-react's List / IconListItem are div listboxes built for
// icon-font glyphs with no slot for a control, so rows that host a Switch,
// Checkbox or button use Material Web's own md-list / md-list-item (the same
// @material/web the library wraps). Slots on a row: "start", "headline",
// "supporting-text", "trailing-supporting-text", "end".
export interface ListProps extends HTMLAttributes<HTMLElement> {
    children?: ReactNode;
}

export const List = forwardRef<MdList, ListProps>(function List({ className, ...props }, ref) {
    return createElement('md-list', {
        ref,
        className: 'ubv-list' + (className ? ' ' + className : ''),
        ...props,
    });
});

export interface ListItemProps extends HTMLAttributes<HTMLElement> {
    /** "text" is static; "button" is interactive with a state layer; "link" needs href. */
    type?: 'text' | 'button' | 'link';
    href?: string;
    target?: '_blank' | '_parent' | '_self' | '_top' | '';
    disabled?: boolean;
    children?: ReactNode;
}

export const ListItem = forwardRef<MdListItem, ListItemProps>(function ListItem(
    { className, type = 'text', disabled, ...props },
    ref,
) {
    return createElement('md-list-item', {
        ref,
        className: 'ubv-list-item' + (className ? ' ' + className : ''),
        type,
        disabled: disabled ? true : undefined,
        ...props,
    });
});

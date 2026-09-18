// uBlockVanced - the logger's virtual row renderer.
//
// The DOM shape (#vwRenderer / #vwScroller / #vwVirtualContent / #vwContent /
// #vwLineSizer, `.logEntry > .fields > span` x8) and the runtime stylesheet in
// `#vwRendererRuntimeStyles` are upstream's, so every rule in
// src/css/logger-ui.css -- row colouring by data-status, realm tinting, the
// hover unroll, the URL emphasis -- keeps applying unchanged. Only the
// windowing and the column-resize handles are React.

import {
    COLUMN_FILTER,
    COLUMN_INITIATOR,
    COLUMN_METHOD,
    COLUMN_PARTYNESS,
    COLUMN_RESULT,
    COLUMN_TIMESTAMP,
    COLUMN_TYPE,
    COLUMN_URL,
    type EntryView,
    type LogEntry,
    type LoggerSettings,
    entryView,
    hrefForURL,
    normalizeColumnWidths,
    regexFromURLFilteringResult,
} from '../model';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
    ClipboardEvent as ReactClipboardEvent,
    MouseEvent as ReactMouseEvent,
    PointerEvent as ReactPointerEvent,
    ReactNode,
} from 'react';
import { send } from '../../../shared/vapi';

/******************************************************************************/

interface Props {
    rows: LogEntry[];
    revision: number;
    settings: LoggerSettings;
    vExpanded: boolean;
    onOpenEntry(view: EntryView): void;
    onColumnWidths(widths: number[], persist: boolean): void;
}

interface Layout {
    lineHeight: number;
    lineCount: number;
    handleLeft: [ number, number ];
    handlesVisible: [ boolean, boolean ];
}

const ZWSP = '​';

/******************************************************************************/

// Upstream's nodeFromURL(): the matched part of the URL is emphasized, and
// http(s) URLs get the corner link the stylesheet turns into an arrow.
function UrlCell({ url, re, type }: { url: string; re: RegExp | undefined; type: string }) {
    const parts: ReactNode[] = [];
    if ( re === undefined ) {
        parts.push(url);
    } else {
        const matches = re.exec(url);
        if ( matches === null || matches[0].length === 0 ) {
            parts.push(url);
        } else {
            if ( matches.index !== 0 ) { parts.push(url.slice(0, matches.index)); }
            parts.push(<b key="b">{url.slice(matches.index, re.lastIndex)}</b>);
            if ( re.lastIndex !== url.length ) { parts.push(url.slice(re.lastIndex)); }
        }
    }
    const href = hrefForURL(url, type);
    if ( href !== undefined ) {
        parts.push(<a key="a" href={href} target="_blank" rel="noopener noreferrer" />);
    }
    return <span>{parts}</span>;
}

/******************************************************************************/

function Row({ view, top, height }: { view: EntryView; top: number; height: number }) {
    const { cells, entry } = view;
    const classes = [ 'fields' ];
    if ( view.realmClass !== '' ) { classes.push(view.realmClass); }
    if ( entry.voided ) { classes.push('voided'); }
    if ( view.canDetails ) { classes.push('canDetails'); }
    if ( view.canLookup ) { classes.push('canLookup'); }
    if ( view.isException ) { classes.push('isException'); }
    if ( view.isScriptlet ) { classes.push('scriptlet'); }
    if ( view.isRedirect ) { classes.push('redirect'); }

    const attrs: Record<string, string> = {};
    if ( entry.tabId !== undefined ) { attrs['data-tabid'] = `${entry.tabId}`; }
    if ( view.isMessage ) {
        if ( entry.type !== '' ) { attrs['data-type'] = entry.type; }
    } else {
        if ( view.status !== '' ) { attrs['data-status'] = view.status; }
        if ( view.modifier ) { attrs['data-modifier'] = ''; }
        if ( entry.tabHostname !== '' ) { attrs['data-tabhn'] = entry.tabHostname; }
        if ( entry.docHostname !== '' ) { attrs['data-dochn'] = entry.docHostname; }
        if ( view.parties !== '' ) { attrs['data-parties'] = view.parties; }
        if ( view.aliasURL !== '' ) { attrs['data-aliasid'] = `${entry.id}`; }
    }

    if ( view.isMessage ) {
        return (
            <div className="logEntry" style={{ top, height }} data-row-id={entry.id}>
                <div className={classes.join(' ')} {...attrs}>
                    <span>{cells[COLUMN_TIMESTAMP] ?? ''}</span>{ZWSP}
                    <span>{cells[COLUMN_FILTER] ?? ''}</span>{ZWSP}
                    <span />{ZWSP}<span />{ZWSP}<span />{ZWSP}<span />{ZWSP}<span />{ZWSP}<span />
                </div>
            </div>
        );
    }

    // The cosmetic-filter prefix is split off so the stylesheet can hide it
    // and strike through an exception's selector.
    const filterText = view.filterText;
    const match = /^#@?#/.exec(filterText);
    const filterCell = match !== null
        ? <><span>{match[0]}</span><span>{filterText.slice(match[0].length)}</span></>
        : filterText;

    let re: RegExp | undefined;
    const filter = entry.filter;
    if ( view.filteringType === 'static' && typeof filter?.regex === 'string' ) {
        re = new RegExp(filter.regex, 'gi');
    } else if ( view.filteringType === 'dynamicUrl' && Array.isArray(filter?.rule) ) {
        re = regexFromURLFilteringResult(filter.rule.join(' '));
    }

    return (
        <div className="logEntry" style={{ top, height }} data-row-id={entry.id}>
            <div className={classes.join(' ')} {...attrs}>
                <span>{cells[COLUMN_TIMESTAMP] ?? ''}</span>{ZWSP}
                <span>{filterCell}</span>{ZWSP}
                <span>{cells[COLUMN_RESULT] ?? ''}</span>{ZWSP}
                <span>{cells[COLUMN_INITIATOR] ?? ''}</span>{ZWSP}
                <span>{cells[COLUMN_PARTYNESS] ?? ''}</span>{ZWSP}
                <span>{cells[COLUMN_METHOD] ?? ''}</span>{ZWSP}
                <span>{cells[COLUMN_TYPE] ?? ''}</span>{ZWSP}
                <UrlCell url={cells[COLUMN_URL] ?? ''} re={re} type={cells[COLUMN_TYPE] ?? ''} />
            </div>
        </div>
    );
}

/******************************************************************************/

export function LogTable({ rows, revision, settings, vExpanded, onOpenEntry, onColumnWidths }: Props) {
    const renderer = useRef<HTMLDivElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const sizer = useRef<HTMLDivElement>(null);
    const scrollable = useRef<HTMLDivElement>(null);
    const [ layout, setLayout ] = useState<Layout>({
        lineHeight: 0, lineCount: 0, handleLeft: [ 0, 0 ], handlesVisible: [ false, false ],
    });
    const [ topPix, setTopPix ] = useState(0);
    const rowCount = useRef(0);
    const drag = useRef<{ col: number; x: number; widths: number[] } | null>(null);

    const columnsKey = settings.columns.join(',');
    const widthsKey = (settings.columnWidths ?? []).join(',');

    /**************************************************************************/

    // Upstream's onLayoutChanged(): measure one line, publish the per-column
    // widths through #vwRendererRuntimeStyles, size the row pool.
    const applyLayout = useCallback(() => {
        const host = renderer.current;
        const line = sizer.current?.querySelector<HTMLElement>('.oneLine');
        if ( host === null || line === null || line === undefined ) { return; }

        let lineHeight = line.clientHeight;
        if ( vExpanded ) { lineHeight *= settings.linesPerEntry; }
        const vwHeight = host.clientHeight;
        const lineCount = lineHeight !== 0 ? Math.ceil(vwHeight / lineHeight) + 1 : 0;

        const spans = Array.from(line.querySelectorAll('span'));
        const cellWidths = spans.map((el, i) =>
            settings.columns[i] !== false ? el.clientWidth + 1 : 0
        );
        const reservedWidth =
            cellWidths[COLUMN_TIMESTAMP] +
            cellWidths[COLUMN_RESULT] +
            cellWidths[COLUMN_PARTYNESS] +
            cellWidths[COLUMN_METHOD] +
            cellWidths[COLUMN_TYPE];

        const cw = settings.columnWidths;
        if ( cw && cellWidths[COLUMN_FILTER] !== 0 && cellWidths[COLUMN_INITIATOR] !== 0 ) {
            const widths = normalizeColumnWidths(cw);
            cellWidths[COLUMN_FILTER] = widths[0];
            cellWidths[COLUMN_INITIATOR] = widths[1];
            cellWidths[COLUMN_URL] = widths[2];
        } else {
            cellWidths[COLUMN_URL] = 0.5;
            if ( cellWidths[COLUMN_FILTER] === 0 && cellWidths[COLUMN_INITIATOR] === 0 ) {
                cellWidths[COLUMN_URL] = 1;
            } else if ( cellWidths[COLUMN_FILTER] === 0 ) {
                cellWidths[COLUMN_INITIATOR] = 0.35;
                cellWidths[COLUMN_URL] = 0.65;
            } else if ( cellWidths[COLUMN_INITIATOR] === 0 ) {
                cellWidths[COLUMN_FILTER] = 0.35;
                cellWidths[COLUMN_URL] = 0.65;
            } else {
                cellWidths[COLUMN_FILTER] = 0.25;
                cellWidths[COLUMN_INITIATOR] = 0.25;
                cellWidths[COLUMN_URL] = 0.5;
            }
        }

        const cssRules = [
            '#vwContent .logEntry {',
            `  height: ${lineHeight}px;`,
            '}',
            `#vwContent .logEntry > div > span:nth-of-type(${COLUMN_TIMESTAMP + 1}) {`,
            `  width: ${cellWidths[COLUMN_TIMESTAMP]}px;`,
            '}',
            `#vwContent .logEntry > div > span:nth-of-type(${COLUMN_FILTER + 1}) {`,
            `  width: calc(calc(100% - ${reservedWidth}px) * ${cellWidths[COLUMN_FILTER]});`,
            '}',
            `#vwContent .logEntry > div.messageRealm > span:nth-of-type(${COLUMN_FILTER + 1}) {`,
            `  width: calc(100% - ${cellWidths[COLUMN_TIMESTAMP]}px);`,
            '}',
            `#vwContent .logEntry > div > span:nth-of-type(${COLUMN_RESULT + 1}) {`,
            `  width: ${cellWidths[COLUMN_RESULT]}px;`,
            '}',
            `#vwContent .logEntry > div > span:nth-of-type(${COLUMN_INITIATOR + 1}) {`,
            `  width: calc(calc(100% - ${reservedWidth}px) * ${cellWidths[COLUMN_INITIATOR]});`,
            '}',
            `#vwContent .logEntry > div > span:nth-of-type(${COLUMN_PARTYNESS + 1}) {`,
            `  width: ${cellWidths[COLUMN_PARTYNESS]}px;`,
            '}',
            `#vwContent .logEntry > div > span:nth-of-type(${COLUMN_METHOD + 1}) {`,
            `  width: ${cellWidths[COLUMN_METHOD]}px;`,
            '}',
            `#vwContent .logEntry > div > span:nth-of-type(${COLUMN_TYPE + 1}) {`,
            `  width: ${cellWidths[COLUMN_TYPE]}px;`,
            '}',
            `#vwContent .logEntry > div > span:nth-of-type(${COLUMN_URL + 1}) {`,
            `  width: calc(calc(100% - ${reservedWidth}px) * ${cellWidths[COLUMN_URL]});`,
            '}',
            '',
        ];
        for ( let i = 0; i < cellWidths.length; i++ ) {
            if ( cellWidths[i] !== 0 ) { continue; }
            cssRules.push(
                `#vwContent .logEntry > div > span:nth-of-type(${i + 1}) {`,
                '  display: none;',
                '}',
            );
        }
        let style = document.getElementById('vwRendererRuntimeStyles');
        if ( style === null ) {
            style = document.createElement('style');
            style.id = 'vwRendererRuntimeStyles';
            document.head.appendChild(style);
        }
        style.textContent = cssRules.join('\n');

        // Handle positions follow the very numbers the rules above use.
        const flexTotal = Math.max(0, host.clientWidth - reservedWidth);
        const x1 = cellWidths[COLUMN_TIMESTAMP] + flexTotal * cellWidths[COLUMN_FILTER];
        const x2 = x1 + cellWidths[COLUMN_RESULT] + flexTotal * cellWidths[COLUMN_INITIATOR];
        setLayout({
            lineHeight,
            lineCount,
            handleLeft: [ x1 - 3, x2 - 3 ],
            handlesVisible: [
                settings.columns[COLUMN_FILTER] !== false,
                settings.columns[COLUMN_INITIATOR] !== false,
            ],
        });
    }, [ settings, vExpanded ]);

    useLayoutEffect(() => { applyLayout(); }, [ applyLayout, columnsKey, widthsKey ]);

    useEffect(() => {
        const target = scrollable.current;
        if ( target === null ) { return; }
        let handle = 0;
        const observer = new ResizeObserver(() => {
            self.cancelAnimationFrame(handle);
            handle = self.requestAnimationFrame(() => { applyLayout(); });
        });
        observer.observe(target);
        return () => {
            self.cancelAnimationFrame(handle);
            observer.disconnect();
        };
    }, [ applyLayout ]);

    /**************************************************************************/

    // Keep the rows the user is looking at in place when new ones arrive.
    useLayoutEffect(() => {
        const delta = rows.length - rowCount.current;
        rowCount.current = rows.length;
        const sc = scroller.current;
        if ( sc === null || layout.lineHeight === 0 ) { return; }
        if ( delta > 0 && sc.scrollTop > 0 ) {
            sc.scrollTop += delta * layout.lineHeight;
            setTopPix(sc.scrollTop);
        } else if ( sc.scrollTop > 0 ) {
            const maxTop = Math.max(0, rows.length * layout.lineHeight - sc.clientHeight);
            if ( sc.scrollTop > maxTop ) {
                sc.scrollTop = maxTop;
                setTopPix(maxTop);
            }
        }
    }, [ rows, layout.lineHeight ]);

    const onScroll = useCallback(() => {
        const sc = scroller.current;
        if ( sc === null ) { return; }
        setTopPix(sc.scrollTop);
    }, []);

    /**************************************************************************/

    // Selection-aware row activation, as upstream: a click that changed the
    // text selection is a selection, not a row activation.
    const selectionAtMouseDown = useRef<string | undefined>(undefined);
    const selectionTimer = useRef(0);

    const onMouseDown = useCallback((ev: ReactMouseEvent) => {
        if ( ev.button !== 0 ) { return; }
        if ( selectionAtMouseDown.current !== undefined ) { return; }
        selectionAtMouseDown.current = document.getSelection()?.toString() ?? '';
    }, []);

    const onClick = useCallback((ev: ReactMouseEvent) => {
        if ( ev.button !== 0 ) { return; }
        const target = ev.target as HTMLElement;
        const anchor = target.closest('a');
        if ( anchor !== null ) {
            void send('codeViewer', {
                what: 'gotoURL',
                details: { url: anchor.getAttribute('href') ?? '', select: true },
            });
            ev.preventDefault();
            ev.stopPropagation();
            return;
        }
        const row = target.closest('.canDetails');
        if ( row === null ) {
            selectionAtMouseDown.current = undefined;
            return;
        }
        const id = parseInt((row.parentElement as HTMLElement | null)?.dataset.rowId ?? '', 10);
        if ( Number.isNaN(id) ) {
            selectionAtMouseDown.current = undefined;
            return;
        }
        self.clearTimeout(selectionTimer.current);
        selectionTimer.current = self.setTimeout(() => {
            const now = document.getSelection()?.toString() ?? '';
            const changed = now !== selectionAtMouseDown.current;
            selectionAtMouseDown.current = undefined;
            if ( changed && now !== '' ) { return; }
            const entry = rows.find(candidate => candidate.id === id);
            if ( entry === undefined ) { return; }
            onOpenEntry(entryView(entry));
        }, 333);
    }, [ onOpenEntry, rows ]);

    // Cells are separated by \x1F / zero-width spaces; a copy turns them into
    // tabs so the clipboard content stays tabular.
    const onCopy = useCallback((ev: ReactClipboardEvent) => {
        const text = document.getSelection()?.toString() ?? '';
        if ( /\x1F|​/.test(text) === false ) { return; }
        ev.clipboardData.setData('text/plain', text.replace(/\x1F|​/g, '\t'));
        ev.preventDefault();
    }, []);

    /**************************************************************************/

    const onHandleDown = useCallback((ev: ReactPointerEvent<HTMLDivElement>, col: number) => {
        drag.current = {
            col,
            x: ev.clientX,
            widths: normalizeColumnWidths(settings.columnWidths),
        };
        ev.currentTarget.setPointerCapture(ev.pointerId);
        ev.preventDefault();
    }, [ settings.columnWidths ]);

    const onHandleMove = useCallback((ev: ReactPointerEvent<HTMLDivElement>) => {
        const state = drag.current;
        const host = renderer.current;
        const line = sizer.current?.querySelector<HTMLElement>('.oneLine');
        if ( state === null || host === null || line === null || line === undefined ) { return; }
        const spans = Array.from(line.querySelectorAll('span'));
        let reservedWidth = 0;
        for ( let i = 0; i < spans.length; i++ ) {
            if ( i === COLUMN_FILTER || i === COLUMN_INITIATOR || i === COLUMN_URL ) { continue; }
            if ( settings.columns[i] === false ) { continue; }
            reservedWidth += spans[i].clientWidth + 1;
        }
        const flexTotal = host.clientWidth - reservedWidth;
        if ( flexTotal <= 0 ) { return; }
        const dFrac = (ev.clientX - state.x) / flexTotal;
        const widths = state.widths.slice();
        if ( state.col === COLUMN_FILTER ) {
            widths[0] += dFrac;
        } else {
            widths[1] += dFrac;
        }
        onColumnWidths(normalizeColumnWidths(widths), false);
    }, [ onColumnWidths, settings.columns ]);

    const onHandleUp = useCallback(() => {
        if ( drag.current === null ) { return; }
        drag.current = null;
        onColumnWidths(normalizeColumnWidths(settings.columnWidths), true);
    }, [ onColumnWidths, settings.columnWidths ]);

    /**************************************************************************/

    const { lineHeight, lineCount } = layout;
    const topRow = lineHeight !== 0 ? Math.floor(topPix / lineHeight) : 0;
    const offset = lineHeight !== 0 ? -(topPix % lineHeight) : 0;
    const wholeHeight = Math.max(rows.length * lineHeight, renderer.current?.clientHeight ?? 0);

    const slots = useMemo(() => {
        const out: Array<{ key: number; view: EntryView | null; top: number }> = [];
        for ( let i = 0; i < lineCount; i++ ) {
            const entry = rows[topRow + i];
            out.push({
                key: i,
                view: entry !== undefined ? entryView(entry) : null,
                top: offset + i * lineHeight,
            });
        }
        return out;
        // `revision` covers in-place mutations of the row objects.
    }, [ lineCount, lineHeight, offset, revision, rows, topRow ]);

    return (
        <div className="vscrollable" ref={scrollable}>
            <div id="vwRenderer" ref={renderer}>
                <div id="vwScroller" ref={scroller} onScroll={onScroll}>
                    <div id="vwVirtualContent" style={{ height: wholeHeight }}>
                        <div
                            id="vwContent"
                            style={{ top: topPix }}
                            onClickCapture={onClick}
                            onMouseDown={onMouseDown}
                            onCopy={onCopy}
                        >
                            {slots.map(slot => (
                                <Fragment key={slot.key}>
                                    {slot.view !== null
                                        ? <Row view={slot.view} top={slot.top} height={lineHeight} />
                                        : <div className="logEntry" style={{ top: slot.top, height: lineHeight }} />}
                                </Fragment>
                            ))}
                        </div>
                    </div>
                </div>
                <div id="vwLineSizer" ref={sizer}>
                    <div className="logEntry oneLine">
                        <div className="fields">
                            <span>00:00:00</span><span>&nbsp;</span><span>**</span><span>&nbsp;</span>
                            <span>3,3</span><span>options</span><span>inline-script</span><span>&nbsp;</span>
                        </div>
                    </div>
                </div>
                <div id="columnResizeHandles">
                    {([ COLUMN_FILTER, COLUMN_INITIATOR ] as const).map((col, i) => (
                        layout.handlesVisible[i] ? (
                            <div
                                key={col}
                                className="column-resize-handle"
                                role="separator"
                                aria-orientation="vertical"
                                style={{ left: layout.handleLeft[i] }}
                                onPointerDown={ev => { onHandleDown(ev, col); }}
                                onPointerMove={onHandleMove}
                                onPointerUp={onHandleUp}
                                onPointerCancel={onHandleUp}
                            />
                        ) : null
                    ))}
                </div>
            </div>
        </div>
    );
}

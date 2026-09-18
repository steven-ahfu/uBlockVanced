import { TextButton } from 'material-expressive-react/button';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { t } from '../../shared/i18n';
import { gotoURL } from './useSupport';

// Upstream support messages carry light markup: <code>, <b>, <u>, <a href>
// and <span data-url> click targets. They are parsed into React nodes here
// so every link is a Material text button and nothing is injected as HTML.
// <span data-url> opens through the background exactly as upstream does.

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

function renderNodes(nodes: ArrayLike<ChildNode>, prefix: string): ReactNode[] {
    const out: ReactNode[] = [];
    let n = 0;
    for ( const node of Array.from(nodes) ) {
        const key = prefix + n;
        n += 1;
        if ( node.nodeType === TEXT_NODE ) {
            out.push(node.nodeValue ?? '');
            continue;
        }
        if ( node.nodeType !== ELEMENT_NODE ) { continue; }
        const elem = node as Element;
        const children = renderNodes(elem.childNodes, key + '.');
        const dataURL = elem.getAttribute('data-url') ?? '';
        if ( dataURL !== '' ) {
            out.push(
                <TextButton key={key} className="ubv-inline-link" data-tip={dataURL}
                    onClick={ev => { gotoURL(dataURL, ev.shiftKey); }}>
                    {children}
                </TextButton>,
            );
            continue;
        }
        switch ( elem.tagName ) {
        case 'A': {
            const href = elem.getAttribute('href') ?? '';
            out.push(
                <TextButton key={key} className="ubv-inline-link" href={href} target="_blank"
                    data-tip={t('genericOpenDocumentation')}>
                    {children}
                </TextButton>,
            );
            break;
        }
        case 'CODE':
            out.push(<span key={key} className="ubv-code-text">{children}</span>);
            break;
        case 'B':
        case 'STRONG':
            out.push(<span key={key} className="ubv-strong-text">{children}</span>);
            break;
        case 'U':
            out.push(<span key={key} className="ubv-underline-text">{children}</span>);
            break;
        default:
            out.push(<span key={key}>{children}</span>);
            break;
        }
    }
    return out;
}

export function useProse(html: string): ReactNode[] {
    return useMemo(() => {
        const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
        return renderNodes(doc.body.childNodes, 'p');
    }, [ html ]);
}

// A localized paragraph: the message's markup becomes Material components.
export function Prose({ k, className }: { k: string; className?: string }) {
    const parts = useProse(t(k));
    return <p className={className}>{parts}</p>;
}

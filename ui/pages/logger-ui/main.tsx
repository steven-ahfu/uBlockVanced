import { App } from './App';
import { bootstrapTheme } from '../../shared/theme';
import { createRoot } from 'react-dom/client';
import '../../shared/page.css';
import './logger-ui.css';

// The page's HTML is generated from src/logger-ui.html at build time (see
// ui/build.mjs), so the upstream markup is still in <body> when the bundle
// runs. React owns the whole UI now; only three nodes are kept:
//
//   #showdom       the latch the retained DOM inspector toggles (hidden)
//   #modalOverlay  the overlay that inspector's commit dialog is shown in
//   #templates     the dialog templates it clones from
//
// Everything else upstream shipped is dropped before the first render.
const KEEP_IN_BODY = new Set([ 'modalOverlay', 'templates' ]);

function pruneLegacyMarkup(root: HTMLElement): void {
    let bridge = document.getElementById('ubv-legacy-bridge');
    if ( bridge === null ) {
        bridge = document.createElement('div');
        bridge.id = 'ubv-legacy-bridge';
        bridge.hidden = true;
        document.body.appendChild(bridge);
    }
    const latch = document.getElementById('showdom');
    if ( latch !== null ) { bridge.appendChild(latch); }
    for ( const node of Array.from(document.body.children) ) {
        if ( node === root || node === bridge ) { continue; }
        if ( KEEP_IN_BODY.has(node.id) ) { continue; }
        if ( node.tagName === 'SCRIPT' ) { continue; }
        node.remove();
    }
}

bootstrapTheme();

const container = document.getElementById('root');
if ( container !== null ) {
    pruneLegacyMarkup(container);
    createRoot(container).render(<App />);
}

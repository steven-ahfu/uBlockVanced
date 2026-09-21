import { App } from './App';
import { bootstrapTheme } from '../../shared/theme';
import { createRoot } from 'react-dom/client';
import '../../shared/page.css';
import './element-probe-panel.css';

// This page ships its own element-probe-panel.html (React root, the palette
// stylesheets and js/theme.js), so normally there is nothing to do here.
// The guard stays for the other case: a package built before that html
// existed carries the upstream markup and no palette. Drop what it brought
// and pull the palette in, so the panel renders the same either way.
function claimDocument(): void {
    const root = document.getElementById('root');
    for ( const node of Array.from(document.body.children) ) {
        if ( node === root || node.localName === 'script' ) { continue; }
        node.remove();
    }
    if ( document.querySelector('script[src$="js/theme.js"]') !== null ) { return; }
    for ( const href of [ 'css/themes/default.css', 'css/common.css' ] ) {
        if ( document.querySelector(`link[href="${href}"]`) !== null ) { continue; }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.append(link);
    }
    const rootcl = document.documentElement.classList;
    if ( rootcl.contains('dark') === false && rootcl.contains('light') === false ) {
        rootcl.add('dark');
    }
}

claimDocument();
bootstrapTheme();

const container = document.getElementById('root');
if ( container !== null ) {
    createRoot(container).render(<App />);
}

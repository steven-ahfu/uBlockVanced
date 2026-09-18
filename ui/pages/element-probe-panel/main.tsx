import { App } from './App';
import { bootstrapTheme } from '../../shared/theme';
import { createRoot } from 'react-dom/client';
import '../../shared/page.css';
import './element-probe-panel.css';

// ui/build.mjs still derives dist/ui/element-probe-panel.html from the
// upstream page while its `legacyPages` map lists this page; that document
// carries the upstream markup and loads neither the palette nor js/theme.js.
// Drop what it brought and pull the palette in, so the panel renders the same
// whichever HTML the build shipped.
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

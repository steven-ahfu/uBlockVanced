import { applyMaterialTypography } from 'material-expressive-react/theme';
import '../../node_modules/material-expressive-react/dist/material-expressive-react.css';
import './tokens.css';

let applied = false;

// Installs the Material typescale styles and marks the document so the
// Material token bridge (tokens.css) is active. Upstream js/theme.js already
// sets .dark/.light/.catppuccin-* on <html>; tokens.css maps whatever palette
// is active onto --md-sys-color-*.
export function bootstrapTheme(): void {
    if ( applied ) { return; }
    applied = true;
    applyMaterialTypography();
    document.documentElement.classList.add('ubv-m3');
}

/*******************************************************************************

    uBlockVanced - the palette must resolve before theme.js runs.

    theme.js adds the `dark` class only after a vAPI.messaging round-trip, so
    any document paints at least one frame without it. A --ctp-* reference that
    does not resolve is invalid at computed-value time, and the property falls
    back to its initial value. For the element picker's SVG `fill` that initial
    value is opaque black, which covers the whole page being picked from.

    These tests pin the two defences: the dark palette is defined on bare
    :root, and the picker's own fills carry literal fallbacks regardless.

*/

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Comments are stripped up front: a comment sitting above a rule is part of
// the same run of non-brace text, and would otherwise be read as part of that
// rule's selector list.
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Custom properties declared by any rule whose selector list includes a bare
// `:root` (no class, no attribute, no descendant).
const bareRootProperties = css => {
    const names = new Set();
    for ( const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g) ) {
        const selectors = match[1].split(',').map(s => s.trim());
        if ( selectors.includes(':root') === false ) { continue; }
        for ( const decl of match[2].matchAll(/(--[\w-]+)\s*:/g) ) {
            names.add(decl[1]);
        }
    }
    return names;
};

// var() references appearing in a `fill:` or `stroke:` declaration. These are
// the destructive ones: both are inherited SVG paint properties whose initial
// value is opaque black, so a dropped declaration paints rather than fades.
const paintVarReferences = css => {
    const refs = [];
    for ( const decl of css.matchAll(/(?:fill|stroke)\s*:([^;}]*)/g) ) {
        for ( const match of decl[1].matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g) ) {
            refs.push({ name: match[1], hasFallback: match[2] === ',' });
        }
    }
    return refs;
};

/******************************************************************************/

describe('theme palette', ( ) => {
    it('defines the Catppuccin palette on bare :root', ( ) => {
        const defined = bareRootProperties(read('src/css/themes/default.css'));
        for ( const name of [ '--ctp-base', '--ctp-crust', '--ctp-mantle' ] ) {
            assert.ok(defined.has(name), `${name} is not defined on bare :root`);
        }
    });

    it('leaves no picker colour that can collapse to opaque black', ( ) => {
        // The picker is the sharp edge: its sea covers the viewport, so a
        // dropped declaration is not a wrong shade, it is an opaque sheet.
        const palette = bareRootProperties(read('src/css/themes/default.css'));
        const unresolvable = paintVarReferences(read('src/css/epicker-ui.css'))
            .filter(ref => ref.hasFallback === false && palette.has(ref.name) === false)
            .map(ref => ref.name);
        assert.deepEqual([ ...new Set(unresolvable) ], []);
    });
});

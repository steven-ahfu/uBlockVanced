/*******************************************************************************

    uBlockVanced - the element picker's document must stay transparent.

    The picker dialog is an iframe pinned over the whole inspected page:
    position fixed, 100vw by 100vh (pickerCSSStyle in js/scriptlets/epicker.js).
    So anything opaque painted on `html` or `body` is not a styling detail, it
    is a sheet of colour over the entire site with the page invisible behind
    it. That has now shipped twice:

      0.3.8  --ctp-crust was class-only, so the sea's `fill` was invalid at
             computed-value time and fell back to its initial value, black.
      0.4.0  the shared page frame sets
             `:root.ubv-m3 body { background: var(--md-sys-color-background) }`,
             which outranks a bare `html, body { background: transparent }`.

    Both were a losing cascade, not a typo, so this test resolves the cascade
    rather than grepping for a string: it reads the stylesheets the picker
    actually loads, in load order, and works out which declaration wins.

*/

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

// The picker bundles the shared page frame and then its own sheet, in that
// order (ui/pages/epicker/main.tsx). Later files win ties, as in the browser.
const PICKER_STYLESHEETS = [
    'ui/shared/page.css',
    'ui/pages/epicker/epicker.css',
];

// a-b-c specificity. No ids are used in these sheets, so counting classes,
// attributes and pseudo-classes against elements and pseudo-elements is
// enough to order them correctly.
const specificity = selector => {
    const ids = (selector.match(/#[\w-]+/g) || []).length;
    const classes = (selector.match(/[.[:][\w-]+/g) || []).length;
    const elements = (selector.match(/(^|[\s>+~])[a-z]+/g) || []).length;
    return ids * 10000 + classes * 100 + elements;
};

/**
 * Resolve the winning `background` (or `background-color`) for an element,
 * across the given stylesheets, in load order.
 */
const resolveBackground = (stylesheets, matches) => {
    let best = null;
    for ( const sheet of stylesheets ) {
        const css = read(sheet);
        for ( const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g) ) {
            const declarations = rule[2];
            const found = [ ...declarations.matchAll(/(?:^|;)\s*background(?:-color)?\s*:([^;]+)/g) ];
            if ( found.length === 0 ) { continue; }
            const value = found[found.length - 1][1].trim();
            const important = /!\s*important/.test(value);
            for ( const selector of rule[1].split(',').map(s => s.trim()) ) {
                if ( matches(selector) === false ) { continue; }
                const rank = specificity(selector) + (important ? 1000000 : 0);
                // Later sheets and later rules win ties, so >= not >.
                if ( best === null || rank >= best.rank ) {
                    best = { rank, value, selector, sheet };
                }
            }
        }
    }
    return best;
};

const isTransparent = value =>
    /^transparent/.test(value.replace(/!\s*important/, '').trim()) ||
    /^rgba?\([^)]*[,/]\s*0\s*\)/.test(value);

/******************************************************************************/

describe('element picker document', ( ) => {
    it('never paints its own background', ( ) => {
        // Any selector whose subject is html or body: the picker's document
        // itself, however the rule is qualified.
        const targetsRoot = selector => /(^|[\s,>])(html|body)\s*$/.test(selector);

        const winner = resolveBackground(PICKER_STYLESHEETS, targetsRoot);
        assert.ok(winner !== null, 'no background rule found at all -- did the sheets move?');
        assert.ok(
            isTransparent(winner.value),
            `the picker's document would paint "${winner.value}" ` +
            `(from "${winner.selector}" in ${winner.sheet}). That iframe covers ` +
            `the whole inspected page, so this is a sheet of colour over the site.`
        );
    });

    it('keeps a literal fallback on every colour the sea paints with', ( ) => {
        // `fill` and `stroke` are inherited SVG paint properties whose initial
        // value is opaque black. An unresolved var() in one of them does not
        // give a wrong shade, it gives an opaque overlay -- the 0.3.8 bug.
        const css = read('ui/pages/epicker/epicker.css');
        const offenders = [];
        for ( const decl of css.matchAll(/\b(?:fill|stroke)\s*:([^;}]*)/g) ) {
            for ( const ref of decl[1].matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g) ) {
                if ( ref[2] !== ',' ) { offenders.push(ref[1]); }
            }
        }
        assert.deepEqual([ ...new Set(offenders) ], []);
    });

    it('lets the page show through the dim', ( ) => {
        // The sea is the intended overlay, but it has to be see-through or it
        // is the same bug wearing a different hat.
        const css = read('ui/pages/epicker/epicker.css');
        const seaFills = [ ...css.matchAll(/svg#sea[^{]*\{[^}]*?fill:([^;}]+)/g) ]
            .map(m => m[1].trim());
        assert.ok(seaFills.length !== 0, 'no sea fill found -- did the selector change?');
        for ( const fill of seaFills ) {
            const alpha = /\/\s*([0-9.]+)\s*\)/.exec(fill);
            assert.ok(alpha !== null, `sea fill has no alpha channel: ${fill}`);
            assert.ok(
                Number(alpha[1]) < 0.9,
                `sea fill is all but opaque (${alpha[1]}): ${fill}`
            );
        }
    });
});

import { applyRefinement, refinementsFor } from '../src/js/epicker-refine.js';
import {
    candidatePathsForSlot,
    optimizedCandidate,
    splitBodyMarker,
} from '../src/js/epicker-model.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/******************************************************************************/

const labels = list => list.map(r => r.label);
const facts = {
    tag: 'div',
    classes: [ 'd-inline-block' ],
    text: 'Sponsored',
    textContent: 'Sponsored content from a partner we trust',
    path: '/steven-ahfu/uBlockVanced',
};

/******************************************************************************/

describe('optimizedCandidate', ( ) => {
    // The page answers optimizeCandidates with finished selector strings, not
    // the path arrays that were sent to it. Treating one as the other is what
    // stopped the editor updating when a candidate was clicked in 0.4.0.
    it('takes the selector at the rung, as a string', ( ) => {
        const fromPage = [ '##.a', '##.a.b', '##div.a.b' ];
        assert.equal(optimizedCandidate(fromPage, 1), '##.a.b');
    });

    it('clamps a rung beyond what the page returned', ( ) => {
        assert.equal(optimizedCandidate([ '##.a', '##.b' ], 6), '##.b');
        assert.equal(optimizedCandidate([ '##.a', '##.b' ], -1), '##.a');
    });

    it('never returns a joined array', ( ) => {
        // Guards the exact confusion: a path array must not be mistaken for a
        // selector and silently stringified into nonsense.
        assert.equal(optimizedCandidate([ [ 'div > ', '.a' ] ], 0), '');
    });

    it('survives an empty or missing answer', ( ) => {
        assert.equal(optimizedCandidate([], 0), '');
        assert.equal(optimizedCandidate(undefined, 0), '');
    });

    it('is the other half of what candidatePathsForSlot sends', ( ) => {
        // Outgoing is string[][]; incoming is string[]. Pin both so the two
        // shapes cannot quietly converge again.
        const { filters, needBody } = splitBodyMarker([ '##span.a', '##div.b', '##body' ]);
        const outgoing = candidatePathsForSlot(filters, 0, needBody);
        assert.ok(Array.isArray(outgoing[0]), 'outgoing rung should be an array of fragments');
        assert.equal(typeof optimizedCandidate([ '##span.a' ], 0), 'string');
    });
});

/******************************************************************************/

describe('refinementsFor', ( ) => {
    it('offers nothing for an empty or network filter', ( ) => {
        assert.deepEqual(refinementsFor(''), []);
        assert.deepEqual(refinementsFor('||ads.example.com^'), []);
        assert.deepEqual(refinementsFor('##'), []);
    });

    it('offers walking up first, because the wrapper is usually the target', ( ) => {
        const out = refinementsFor('##.d-inline-block', facts, 146);
        assert.deepEqual(labels(out).slice(0, 3), [ ':upward(1)', ':upward(2)', ':upward(3)' ]);
    });

    it('offers the element\'s own text', ( ) => {
        const out = refinementsFor('##.d-inline-block', facts, 146);
        const hasText = out.find(r => r.label === ':has-text()');
        assert.equal(hasText.suffix, ':has-text(Sponsored)');
    });

    it('offers :nth-of-type only when more than one element matches', ( ) => {
        assert.equal(
            refinementsFor('##.a', facts, 1).some(r => r.label.startsWith(':nth-of-type')),
            false
        );
        assert.equal(
            refinementsFor('##.a', facts, 9).some(r => r.label.startsWith(':nth-of-type')),
            true
        );
    });

    it('does not offer an operator the filter already has', ( ) => {
        const out = refinementsFor('##.a:upward(2):has-text(Sponsored)', facts, 5);
        assert.equal(labels(out).some(l => l.startsWith(':upward')), false);
        assert.equal(labels(out).some(l => l.startsWith(':has-text')), false);
    });

    it('escapes parentheses in the text it suggests', ( ) => {
        const out = refinementsFor('##.a', { ...facts, text: 'Buy (now)' }, 3);
        assert.equal(out.find(r => r.label === ':has-text()').suffix, ':has-text(Buy \\(now\\))');
    });

    it('offers a path restriction only when the path says something', ( ) => {
        assert.equal(
            refinementsFor('##.a', { ...facts, path: '/' }, 3).some(r => r.label.startsWith(':matches-path')),
            false
        );
        assert.equal(
            refinementsFor('##.a', facts, 3).some(r => r.label.startsWith(':matches-path')),
            true
        );
    });
});

/******************************************************************************/

describe('applyRefinement', ( ) => {
    it('appends the operator to the filter', ( ) => {
        assert.equal(applyRefinement('##.a', ':upward(2)'), '##.a:upward(2)');
    });

    it('chains operators that may repeat', ( ) => {
        assert.equal(
            applyRefinement('##.a:has-text(Ad)', ':upward(1)'),
            '##.a:has-text(Ad):upward(1)'
        );
    });

    it('refuses to add a second of a singleton operator', ( ) => {
        // Two :upward() in one chain does not compile.
        assert.equal(applyRefinement('##.a:upward(1)', ':upward(3)'), '##.a:upward(1)');
        assert.equal(
            applyRefinement('##.a:nth-of-type(1)', ':nth-of-type(2)'),
            '##.a:nth-of-type(1)'
        );
    });

    it('does not repeat an identical suffix', ( ) => {
        assert.equal(applyRefinement('##.a:has-text(Ad)', ':has-text(Ad)'), '##.a:has-text(Ad)');
    });

    it('leaves an empty filter alone', ( ) => {
        assert.equal(applyRefinement('', ':upward(1)'), '');
        assert.equal(applyRefinement('##.a', ''), '##.a');
    });
});

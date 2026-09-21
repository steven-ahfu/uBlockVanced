/*******************************************************************************

    uBlockVanced - the element picker's candidate arithmetic.

    The specificity ladder decides which filter the user is offered when they
    drag the two sliders, and it had no coverage while it lived inside a DOM
    handler. These pin the rungs against a realistic candidate list.

*/

import { describe, it } from 'node:test';
import {
    SPECIFICITIES,
    candidatePathsForSlot,
    splitBodyMarker,
    userFilterFromCandidate,
} from '../src/js/epicker-model.js';
import assert from 'node:assert/strict';

/******************************************************************************/

// What the page-side picker sends for a span inside a couple of wrappers:
// nearest-first, each entry already carrying its `##` anchor.
const candidates = [
    '##span.promo-label',
    '##div.promo-inner',
    '###sidebar',
    '##body',
];

const join = paths => paths.join('');

/******************************************************************************/

describe('splitBodyMarker', ( ) => {
    it('takes the ##body marker off the list and reports it', ( ) => {
        const { filters, needBody } = splitBodyMarker(candidates);
        assert.equal(needBody, true);
        assert.deepEqual(filters, candidates.slice(0, 3));
    });

    it('leaves a list that does not end in ##body alone', ( ) => {
        const { filters, needBody } = splitBodyMarker([ '##div.a', '##div.b' ]);
        assert.equal(needBody, false);
        assert.deepEqual(filters, [ '##div.a', '##div.b' ]);
    });

    it('does not hand back the caller\'s own array', ( ) => {
        const input = [ '##div.a' ];
        assert.notEqual(splitBodyMarker(input).filters, input);
    });

    it('copes with an empty list', ( ) => {
        assert.deepEqual(splitBodyMarker([]), { filters: [], needBody: false });
    });
});

/******************************************************************************/

describe('candidatePathsForSlot', ( ) => {
    const { filters, needBody } = splitBodyMarker(candidates);

    it('returns one path per specificity rung', ( ) => {
        const paths = candidatePathsForSlot(filters, 0, needBody);
        assert.equal(paths.length, SPECIFICITIES.length);
    });

    it('climbs from the bare element to the full hierarchy', ( ) => {
        const paths = candidatePathsForSlot(filters, 0, needBody);
        // Most generic rung: the element alone, no ancestors.
        assert.equal(join(paths[0]), 'span.promo-label');
        // Most specific rung: the whole path, anchored at the id.
        assert.equal(join(paths[paths.length - 1]), '#sidebar > div.promo-inner > span.promo-label');
    });

    it('stops climbing at an id, because an id is unique in the page', ( ) => {
        const paths = candidatePathsForSlot(filters, 0, needBody);
        for ( const path of paths ) {
            const joined = join(path);
            if ( joined.includes('#sidebar') === false ) { continue; }
            assert.ok(
                joined.startsWith('#sidebar'),
                `climbed past the id: ${joined}`
            );
        }
    });

    it('starts at the slot the user picked', ( ) => {
        const paths = candidatePathsForSlot(filters, 1, needBody);
        for ( const path of paths ) {
            assert.ok(
                join(path).includes('span.promo-label') === false,
                'a deeper slot should not reach back down to the element'
            );
        }
        assert.equal(join(paths[0]), 'div.promo-inner');
    });

    it('drops an attribute value on the rungs that ask for it', ( ) => {
        // The page-side picker only reaches for attributes when the element
        // has neither id nor class, so the candidate starts at the bracket.
        const attrs = [ '##[src="/ads/banner.png"]' ];
        const paths = candidatePathsForSlot(attrs, 0, false);
        assert.equal(join(paths[0]), '[src]', 'value should be dropped at 0b0000');
        assert.equal(
            join(paths[paths.length - 1]),
            '[src="/ads/banner.png"]',
            'value should survive at 0b1111'
        );
    });

    it('drops :nth-of-type on the rungs that ask for it', ( ) => {
        const nth = [ '##li.item:nth-of-type(3)' ];
        assert.equal(join(candidatePathsForSlot(nth, 0, false)[0]), 'li.item');
        assert.equal(
            join(candidatePathsForSlot(nth, 0, false)[7]),
            'li.item:nth-of-type(3)'
        );
    });

    it('anchors at body only where a hierarchy is kept', ( ) => {
        const noId = splitBodyMarker([ '##span.a', '##div.b', '##body' ]);
        const paths = candidatePathsForSlot(noId.filters, 0, noId.needBody);
        // The hierarchy-less rungs describe the element alone, so a body
        // prefix would be a lie about what they match.
        assert.equal(join(paths[0]).startsWith('body'), false);
        assert.equal(join(paths[paths.length - 1]).startsWith('body > '), true);
    });
});

/******************************************************************************/

describe('userFilterFromCandidate', ( ) => {
    it('prefixes a cosmetic filter with the hostname', ( ) => {
        assert.equal(
            userFilterFromCandidate('##.promo', 'example.com', undefined),
            'example.com##.promo'
        );
    });

    it('carries procedural cosmetic filters through unchanged but for the host', ( ) => {
        assert.equal(
            userFilterFromCandidate('##span:has-text(Subscribe):upward(2)', 'example.com', undefined),
            'example.com##span:has-text(Subscribe):upward(2)'
        );
    });

    it('gives a network filter a domain option when it has no host of its own', ( ) => {
        assert.equal(
            userFilterFromCandidate('/ads/banner.png', 'example.com', undefined),
            '/ads/banner.png$domain=example.com'
        );
    });

    it('leaves a hostname-anchored network filter without a domain option', ( ) => {
        assert.equal(
            userFilterFromCandidate('||ads.example.com^', 'example.com', undefined),
            '||ads.example.com^'
        );
    });

    it('appends the resultset option when the picker supplied one', ( ) => {
        assert.equal(
            userFilterFromCandidate('||ads.example.com^', 'example.com', 'image'),
            '||ads.example.com^$image'
        );
        assert.equal(
            userFilterFromCandidate('/ads/banner.png', 'example.com', 'image'),
            '/ads/banner.png$domain=example.com,image'
        );
    });

    it('refuses an empty or invalid filter', ( ) => {
        assert.equal(userFilterFromCandidate('', 'example.com', undefined), undefined);
        assert.equal(userFilterFromCandidate('!', 'example.com', undefined), undefined);
    });
});

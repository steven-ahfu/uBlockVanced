import {
    GENERATED_ID_PATTERNS,
    classifyClasses,
    escCSS,
    escFilterText,
    isGeneratedId,
    suggestProceduralFilters,
} from '../src/js/element-probe/procedural-suggest.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

/******************************************************************************/

const find = (suggestions, label) => suggestions.find(s => s.label === label);
const labels = suggestions => suggestions.map(s => s.label);

// A GitHub-shaped pick: a span of real text inside wrappers whose only classes
// are CSS-module hashes. This is the case the feature exists for.
const githubPick = {
    tag: 'span',
    id: '',
    classes: [ 'CommitHeader-module__commitBranchContainer__zc_XS' ],
    text: 'Subscribe',
    textContent: 'Subscribe',
    path: '/steven-ahfu/uBlockVanced',
    ancestors: [
        { tag: 'div', id: '', classes: [ 'css-1a2b3c4d' ] },
        { tag: 'div', id: '', classes: [ 'sidebar-widget' ] },
        { tag: 'div', id: 'repo-content', classes: [] },
    ],
};

/******************************************************************************/

describe('classifyClasses', ( ) => {
    it('separates generated class names from hand-written ones', ( ) => {
        const { stable, dynamic } = classifyClasses([
            'sidebar-widget',
            'css-1a2b3c4d',
            'Module__a1b2c3',
            'promo',
            'sc-AbCdEfGh',
        ]);
        assert.deepEqual(stable, [ 'sidebar-widget', 'promo' ]);
        assert.deepEqual(dynamic, [ 'css-1a2b3c4d', 'Module__a1b2c3', 'sc-AbCdEfGh' ]);
    });

    it('treats any very long class name as generated', ( ) => {
        const long = 'a'.repeat(41);
        assert.deepEqual(classifyClasses([ long ]).dynamic, [ long ]);
    });
});

/******************************************************************************/

describe('isGeneratedId', ( ) => {
    it('rejects ids that name one instance, not one kind of thing', ( ) => {
        // The picker offered ###\34 9758736 on Hacker News: a valid filter for
        // exactly one comment, dead the moment that comment scrolls off.
        for ( const id of [
            '49758736',
            'comment-49758736',
            'post123456',
            'a1b2c3d4-1111-2222-3333-444455556666',
            'deadbeefdeadbeef12',
        ] ) {
            assert.equal(isGeneratedId(id), true, `${id} should be rejected`);
        }
    });

    it('keeps ids a human wrote', ( ) => {
        for ( const id of [ 'hnmain', 'bigbox', 'repo-content', 'footer2', 'main-nav', 'nav2' ] ) {
            assert.equal(isGeneratedId(id), false, `${id} should be kept`);
        }
    });

    it('ignores an absent id', ( ) => {
        assert.equal(isGeneratedId(''), false);
        assert.equal(isGeneratedId(undefined), false);
    });

    it('stays in step with the copy inside the element picker', ( ) => {
        // epicker.js runs in page context as a classic script, so it cannot
        // import this module and carries its own copy of the rule. Compare the
        // two by behaviour rather than by text: the picker is free to spell the
        // alternation differently, it just may not decide differently.
        const here = path.dirname(fileURLToPath(import.meta.url));
        const src = fs.readFileSync(path.join(here, '..', 'src/js/scriptlets/epicker.js'), 'utf8');
        const line = src.split('\n').find(l => l.startsWith('const reGeneratedId'));
        assert.ok(line !== undefined, 'epicker.js no longer declares reGeneratedId');

        const body = line.slice(line.indexOf('/'), line.lastIndexOf('/i') + 2);
        const pickerRe = new RegExp(body.slice(1, -2), 'i');
        const moduleRe = id => GENERATED_ID_PATTERNS.some(p => new RegExp(p, 'i').test(id));

        for ( const id of [
            '49758736', 'comment-49758736', 'post123456', 'hnmain', 'bigbox',
            'repo-content', 'footer2', 'main-nav', 'ember:42',
            'a1b2c3d4-1111-2222-3333-444455556666', 'deadbeefdeadbeef12',
        ] ) {
            assert.equal(
                pickerRe.test(id), moduleRe(id),
                `picker and module disagree about "${id}"`
            );
        }
    });
});

/******************************************************************************/

describe('escaping', ( ) => {
    it('escapes a leading digit in a CSS identifier', ( ) => {
        // The picker produced ##\#\34 9758736 for id "49758736"; an identifier
        // cannot start with a digit, so it becomes a hex escape.
        assert.equal(escCSS('49758736'), '\\34 9758736');
    });

    it('escapes parentheses inside :has-text() literals', ( ) => {
        assert.equal(escFilterText('Buy (now)'), 'Buy \\(now\\)');
        assert.equal(escFilterText('a\\b'), 'a\\\\b');
    });
});

/******************************************************************************/

describe('suggestProceduralFilters', ( ) => {
    it('returns nothing without a tag', ( ) => {
        assert.deepEqual(suggestProceduralFilters({}), []);
        assert.deepEqual(suggestProceduralFilters(null), []);
    });

    it('leads with the element text, not the hashed class', ( ) => {
        const out = suggestProceduralFilters(githubPick);
        assert.equal(out[0].label, ':has-text()');
        assert.equal(out[0].filter, 'span:has-text(Subscribe)');
        // The CSS-module hash must not appear in any suggestion.
        for ( const s of out ) {
            assert.ok(
                s.filter.includes('CommitHeader-module') === false,
                `generated class leaked into ${s.filter}`
            );
        }
    });

    it('offers :upward() only from an anchor worth walking up from', ( ) => {
        // Every class on this element is generated and it has no id, so there
        // is nothing stable to anchor an :upward() to.
        const out = suggestProceduralFilters({ ...githubPick, classes: [ 'css-9f8e7d6c' ] });
        assert.deepEqual(labels(out).filter(l => l.startsWith(':upward')), []);

        const anchored = suggestProceduralFilters({ ...githubPick, id: 'subscribe-btn', classes: [] });
        assert.equal(find(anchored, ':upward(1)').filter, '#subscribe-btn:upward(1)');
    });

    it('names an ancestor when that ancestor has an identity', ( ) => {
        const out = suggestProceduralFilters({ ...githubPick, id: 'subscribe-btn', classes: [] });
        const byName = out.filter(s => s.label === ':upward(selector)').map(s => s.filter);
        // The hashed wrapper is skipped; the named ones are offered.
        assert.ok(byName.includes('#subscribe-btn:upward(div.sidebar-widget)'));
        assert.ok(byName.includes('#subscribe-btn:upward(#repo-content)'));
        assert.ok(byName.every(f => f.includes('css-1a2b3c4d') === false));
    });

    it('counts levels from the element, not from the first named ancestor', ( ) => {
        const out = suggestProceduralFilters({ ...githubPick, id: 'x', classes: [] });
        assert.equal(find(out, ':upward(2)').filter, '#x:upward(2)');
        assert.match(find(out, ':upward(2)').description, /sidebar-widget/);
    });

    it('uses the text as the anchor when nothing else is stable', ( ) => {
        // The shape this feature exists for: a wrapper worth hiding whose only
        // identifiable content is a label several levels down, and whose every
        // class is a build hash. Neither :has-text() nor :upward() works alone.
        const out = suggestProceduralFilters(githubPick);
        const combined = find(out, ':has-text():upward(2)');
        assert.equal(combined.filter, 'span:has-text(Subscribe):upward(2)');
        assert.match(combined.description, /sidebar-widget/);

        // And it must outrank every plain :upward(), which has no anchor here.
        assert.ok(out.indexOf(combined) < 3, 'text-anchored upward is buried');
    });

    it('ranks a bare-tag filter below one with an anchor', ( ) => {
        const bare = suggestProceduralFilters({ tag: 'div', text: 'Sponsored' });
        const anchored = suggestProceduralFilters({ tag: 'div', classes: [ 'promo' ], text: 'Sponsored' });
        assert.equal(bare[0].filter, 'div:has-text(Sponsored)');
        assert.equal(anchored[0].filter, 'div.promo:has-text(Sponsored)');
        assert.ok(anchored[0].score > bare[0].score);
    });

    it('suggests a path restriction only when the path says something', ( ) => {
        const root = suggestProceduralFilters({ ...githubPick, path: '/' });
        assert.deepEqual(labels(root).filter(l => l.startsWith(':matches-path')), []);

        const deep = suggestProceduralFilters(githubPick);
        assert.equal(
            find(deep, ':matches-path()').filter,
            'span:matches-path(/steven-ahfu/uBlockVanced)'
        );
        assert.equal(
            find(deep, ':matches-path(partial)').filter,
            'span:matches-path(/steven-ahfu/)'
        );
    });

    it('offers a regex form once the text is long enough to vary', ( ) => {
        const out = suggestProceduralFilters({
            tag: 'div',
            classes: [ 'promo' ],
            text: 'Sponsored content from our partners',
        });
        assert.equal(
            find(out, ':has-text(regex)').filter,
            'div.promo:has-text(/Sponsored.*content.*from/i)'
        );
    });

    it('skips the exact-text form when the text is too long to be stable', ( ) => {
        const out = suggestProceduralFilters({ tag: 'div', classes: [ 'promo' ], text: 'x '.repeat(40) });
        assert.equal(find(out, ':has-text()'), undefined);
    });

    it('is ordered best first and stable across identical picks', ( ) => {
        const a = suggestProceduralFilters(githubPick);
        const b = suggestProceduralFilters(githubPick);
        assert.deepEqual(labels(a), labels(b));
        for ( let i = 1; i < a.length; i += 1 ) {
            assert.ok(a[i - 1].score >= a[i].score, 'suggestions are not sorted by score');
        }
    });
});

/*******************************************************************************

    uBlockVanced - procedural cosmetic filter suggestions.

    Given a plain description of a picked element -- its tag, id, classes, text
    and ancestry -- propose procedural filters (:has-text, :upward,
    :matches-path, :min-text-length) ranked by how likely each is to keep
    working.

    This module is deliberately DOM-free. The element picker collects the facts
    in page context and the picker dialog, which has no access to the page,
    turns them into suggestions. Being pure is also the only reason the ranking
    rules can be unit-tested at all.

*/

/******************************************************************************/

// Class names that encode a build hash or a CSS-module suffix change on every
// deploy, so a filter built on one breaks silently. Kept in sync with the
// Element Probe panel's own default patterns.
const DEFAULT_CLASS_PATTERNS = [
    '^[a-z]{1,3}[0-9]{2,}$',            // a12, xyz3471
    '^[A-Za-z]+_[A-Za-z0-9]{5,}$',      // Module_a1b2c3
    '^[A-Za-z0-9]+__[A-Za-z0-9]{5,}$',  // Block__a1b2c3
    '-[0-9a-f]{6,}$',                   // foo-1a2b3c
    '^css-[a-z0-9]{6,}$',               // emotion / styled-components
    '^jsx-[0-9]+$',                     // styled-jsx
    '^sc-[A-Za-z0-9]{6,}$',             // styled-components
    '^[a-z0-9]{8,}$',                   // bare hash
];

// Split class names into the ones worth building a filter on and the ones that
// look generated. A name longer than 40 characters is treated as generated
// whatever it matches: nothing hand-written runs that long.
const classifyClasses = function(classes, patterns = DEFAULT_CLASS_PATTERNS) {
    const compiled = patterns.map(p => new RegExp(p));
    const stable = [];
    const dynamic = [];
    for ( const name of classes ) {
        const isDynamic = name.length > 40 || compiled.some(re => re.test(name));
        if ( isDynamic ) {
            dynamic.push(name);
        } else {
            stable.push(name);
        }
    }
    return { stable, dynamic };
};

/******************************************************************************/

// CSS.escape is unavailable here (no DOM), and only identifiers are ever
// escaped, so the identifier grammar is enough.
const escCSS = function(str) {
    return String(str).replace(/[^\w-]/g, ch => '\\' + ch)
        .replace(/^(-?)(\d)/, '$1\\3$2 ');
};

const escRegex = function(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// uBO reads :has-text(...) up to the matching close paren, so a literal has to
// escape its own parentheses and backslashes.
const escFilterText = function(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
};

/******************************************************************************/

// The most specific selector that still avoids generated class names: an id if
// there is one, else tag.stable-class, else the bare tag. `null` when there is
// nothing but a bare tag and the caller needs better than that.
const baseSelector = function(facts, { allowBareTag = true } = {}) {
    const { stable } = classifyClasses(facts.classes || []);
    if ( stable.length !== 0 ) {
        return `${facts.tag}.${escCSS(stable[0])}`;
    }
    if ( facts.id ) {
        return `#${escCSS(facts.id)}`;
    }
    return allowBareTag ? facts.tag : null;
};

const describeNode = function(node) {
    const { stable } = classifyClasses(node.classes || []);
    if ( node.id ) { return `${node.tag}#${node.id}`; }
    if ( stable.length !== 0 ) { return `${node.tag}.${stable[0]}`; }
    return node.tag;
};

const truncate = (str, n) => (str.length > n ? `${str.slice(0, n)}…` : str);

/******************************************************************************/

// Ranking. A suggestion is only useful if it still matches after the next
// deploy, so the score rewards what tends to survive -- short distinctive text,
// an id or a hand-written class -- and penalises what does not.
const SCORE = {
    hasTextExact: 100,
    hasTextRegex: 74,
    upwardFromId: 88,
    upwardFromClass: 80,
    upwardSelector: 84,
    matchesPath: 52,
    matchesPathPartial: 46,
    minTextLength: 40,
    // Text as the anchor, then walk up to the wrapper. Scored above a plain
    // :upward() because it needs no stable class at all, which is exactly the
    // situation that makes an element hard to filter in the first place.
    hasTextUpward: 92,
};

const scoreAdjustments = function(facts, base) {
    let delta = 0;
    // A filter anchored on nothing but a tag name matches far too much.
    if ( base === facts.tag ) { delta -= 25; }
    // An id is the strongest anchor a page offers.
    if ( base.startsWith('#') ) { delta += 8; }
    return delta;
};

/******************************************************************************/

/**
 * @param {object} facts
 * @param {string} facts.tag           lowercase tag name of the picked element
 * @param {string} [facts.id]
 * @param {string[]} [facts.classes]
 * @param {string} [facts.text]        the element's own text, trimmed
 * @param {string} [facts.textContent] the element's subtree text, trimmed
 * @param {string} [facts.path]        location.pathname of the page
 * @param {object[]} [facts.ancestors] nearest first, excluding <body>/<html>
 * @returns {object[]} suggestions, best first
 */
const suggestProceduralFilters = function(facts) {
    if ( facts instanceof Object === false ) { return []; }
    if ( typeof facts.tag !== 'string' || facts.tag === '' ) { return []; }

    const out = [];
    const push = (suggestion, score) => {
        out.push({ ...suggestion, score });
    };

    const base = baseSelector(facts);
    const adjust = scoreAdjustments(facts, base);

    /* :has-text() ---------------------------------------------------------
       Text is the most deploy-proof thing about an ad slot: the markup around
       "Sponsored" changes, the word does not. */
    const text = (facts.text || facts.textContent || '').trim();
    if ( text.length >= 3 && text.length <= 120 ) {
        if ( text.length <= 60 ) {
            push({
                type: 'has-text',
                label: ':has-text()',
                filter: `${base}:has-text(${escFilterText(text)})`,
                description: `Elements containing “${truncate(text, 40)}”`,
            }, SCORE.hasTextExact + adjust);
        }
        // Long or partly variable text matches better as key words in order.
        const words = text.split(/\s+/).filter(w => w.length > 3);
        if ( text.length > 8 && words.length >= 2 ) {
            const parts = words.slice(0, 3).map(escRegex);
            push({
                type: 'has-text',
                label: ':has-text(regex)',
                filter: `${base}:has-text(/${parts.join('.*')}/i)`,
                description: `Key words in order: ${words.slice(0, 3).join(', ')}`,
            }, SCORE.hasTextRegex + adjust);
        }
    }

    /* :upward() -----------------------------------------------------------
       The thing worth hiding is usually a wrapper with no identity of its own,
       reachable only from a child that has one. */
    const anchor = baseSelector(facts, { allowBareTag: false });
    const ancestors = Array.isArray(facts.ancestors) ? facts.ancestors : [];
    if ( anchor !== null ) {
        const anchorScore = anchor.startsWith('#')
            ? SCORE.upwardFromId
            : SCORE.upwardFromClass;
        for ( let i = 0; i < Math.min(ancestors.length, 3); i += 1 ) {
            const node = ancestors[i];
            const levels = i + 1;
            push({
                type: 'upward',
                label: `:upward(${levels})`,
                filter: `${anchor}:upward(${levels})`,
                description: `Select ${describeNode(node)} — ${levels} level${levels > 1 ? 's' : ''} up`,
            }, anchorScore - i);

            // Naming the ancestor survives markup being re-nested, which a
            // fixed level count does not.
            const ancestorSel = baseSelector(node, { allowBareTag: false });
            if ( ancestorSel !== null ) {
                push({
                    type: 'upward',
                    label: ':upward(selector)',
                    filter: `${anchor}:upward(${ancestorSel})`,
                    description: `Walk up to ${ancestorSel}`,
                }, SCORE.upwardSelector - i);
            }
        }
    }

    /* :has-text() + :upward() ---------------------------------------------
       The common shape of an ad or promo block: a wrapper worth hiding whose
       only identifiable content is a label several levels down. Neither half
       works alone -- the text is on the wrong element, and :upward() has
       nothing stable to start from -- so the text becomes the anchor. */
    if ( text.length >= 3 && text.length <= 60 && ancestors.length !== 0 ) {
        const textAnchor = `${base}:has-text(${escFilterText(text)})`;
        for ( let i = 0; i < Math.min(ancestors.length, 3); i += 1 ) {
            const levels = i + 1;
            push({
                type: 'has-text-upward',
                label: `:has-text():upward(${levels})`,
                filter: `${textAnchor}:upward(${levels})`,
                description: `Select ${describeNode(ancestors[i])} by the “${truncate(text, 24)}” inside it`,
            }, SCORE.hasTextUpward - i + adjust);
        }
    }

    /* :matches-path() -----------------------------------------------------
       Narrows a filter that would otherwise be too broad site-wide. */
    const path = typeof facts.path === 'string' ? facts.path : '';
    if ( path !== '' && path !== '/' ) {
        const segments = path.split('/').filter(Boolean);
        if ( segments.length !== 0 ) {
            push({
                type: 'matches-path',
                label: ':matches-path()',
                filter: `${base}:matches-path(${escRegex(path)})`,
                description: `Only on ${path}`,
            }, SCORE.matchesPath + adjust);
            if ( segments.length > 1 ) {
                push({
                    type: 'matches-path',
                    label: ':matches-path(partial)',
                    filter: `${base}:matches-path(/${escRegex(segments[0])}/)`,
                    description: `On any path under /${segments[0]}/`,
                }, SCORE.matchesPathPartial + adjust);
            }
        }
    }

    /* :min-text-length() --------------------------------------------------
       Separates a populated container from the empty placeholder that shares
       its class. */
    const subtree = (facts.textContent || '').trim();
    if ( subtree.length >= 20 ) {
        const threshold = Math.max(10, Math.floor(subtree.length / 2));
        push({
            type: 'min-text-length',
            label: ':min-text-length()',
            filter: `${base}:min-text-length(${threshold})`,
            description: `Only when it holds at least ${threshold} characters`,
        }, SCORE.minTextLength + adjust);
    }

    // Best first, and stable for equal scores so the order does not jitter
    // between picks of the same element.
    return out
        .map((suggestion, index) => ({ suggestion, index }))
        .sort((a, b) => (b.suggestion.score - a.suggestion.score) || (a.index - b.index))
        .map(entry => entry.suggestion);
};

/******************************************************************************/

export {
    DEFAULT_CLASS_PATTERNS,
    classifyClasses,
    escCSS,
    escFilterText,
    escRegex,
    suggestProceduralFilters,
};

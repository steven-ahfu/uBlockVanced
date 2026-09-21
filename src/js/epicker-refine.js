/*******************************************************************************

    uBlockVanced - refinements offered for the filter in the picker's editor.

    A candidate selector is usually either too broad or too brittle, and the
    fix is almost always one procedural operator away. Rather than make the
    user remember the syntax, the dialog offers the handful that apply to what
    is in the box right now.

    DOM-free and pure so the rules can be tested: the picker collects the facts
    in page context, the dialog turns them into chips.

*/

/******************************************************************************/

const reCosmetic = /^#(\$|\?|\$\?)?#/;

// Operators that may only appear once in a chain, so offering a second is
// offering a filter that will not compile.
const SINGLETON_OPERATORS = [
    ':upward(',
    ':nth-of-type(',
    ':min-text-length(',
    ':matches-path(',
];

const escFilterText = function(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
};

const truncate = (str, n) => (str.length > n ? `${str.slice(0, n)}…` : str);

/******************************************************************************/

/**
 * @param {string} filter the raw text in the editor, `##`-anchored or not
 * @param {object} [facts] what the page said about the picked element
 * @param {number} [matchCount] how many elements the filter currently hits
 * @returns {object[]} refinements, each { label, suffix, description }
 */
const refinementsFor = function(filter, facts = null, matchCount = 0) {
    const text = typeof filter === 'string' ? filter.trim() : '';
    if ( text === '' ) { return []; }
    // Only cosmetic filters take procedural operators.
    if ( reCosmetic.test(text) === false ) { return []; }
    const selector = text.replace(reCosmetic, '');
    if ( selector === '' ) { return []; }

    const has = op => selector.includes(op);
    const out = [];

    // Too broad is the common case, and walking up is the common answer: the
    // thing worth hiding is the wrapper, not the label that identifies it.
    if ( has(':upward(') === false ) {
        for ( const n of [ 1, 2, 3 ] ) {
            out.push({
                label: `:upward(${n})`,
                suffix: `:upward(${n})`,
                description: `Hide the ancestor ${n} level${n > 1 ? 's' : ''} up`,
            });
        }
    }

    // Narrow by the element's own words. Offered before :nth-of-type because
    // text survives a reordered page and a position does not.
    const words = (facts && (facts.text || facts.textContent) || '').trim();
    if ( words !== '' && words.length <= 60 && has(':has-text(') === false ) {
        out.push({
            label: ':has-text()',
            suffix: `:has-text(${escFilterText(words)})`,
            description: `Only the one containing “${truncate(words, 24)}”`,
        });
    }

    // Position is the last resort, and only worth offering when the selector
    // is actually hitting more than one element.
    if ( matchCount > 1 && has(':nth-of-type(') === false ) {
        out.push({
            label: ':nth-of-type(1)',
            suffix: ':nth-of-type(1)',
            description: 'Only the first of its kind among its siblings',
        });
    }

    // Separates a populated container from the empty placeholder sharing its
    // class -- only meaningful when there is text to measure.
    const subtree = (facts && facts.textContent || '').trim();
    if ( subtree.length >= 20 && has(':min-text-length(') === false ) {
        out.push({
            label: ':min-text-length()',
            suffix: `:min-text-length(${Math.max(10, Math.floor(subtree.length / 2))})`,
            description: 'Only when it actually holds content',
        });
    }

    // Restrict to this page's path when the path says something.
    const path = facts && typeof facts.path === 'string' ? facts.path : '';
    if ( path !== '' && path !== '/' && has(':matches-path(') === false ) {
        out.push({
            label: ':matches-path()',
            suffix: `:matches-path(${path})`,
            description: `Only on ${path}`,
        });
    }

    return out;
};

/******************************************************************************/

/**
 * Append a refinement to the filter. Operators go after the selector and
 * before any existing chain is extended, and a singleton operator already
 * present is never added twice.
 *
 * @param {string} filter
 * @param {string} suffix
 * @returns {string}
 */
const applyRefinement = function(filter, suffix) {
    const text = typeof filter === 'string' ? filter.trim() : '';
    if ( text === '' || typeof suffix !== 'string' || suffix === '' ) { return text; }
    for ( const op of SINGLETON_OPERATORS ) {
        if ( suffix.startsWith(op) && text.includes(op) ) { return text; }
    }
    if ( text.endsWith(suffix) ) { return text; }
    return text + suffix;
};

/******************************************************************************/

export {
    applyRefinement,
    refinementsFor,
};

/*******************************************************************************

    uBlockVanced - element picker dialog: the parts that are only arithmetic.

    Lifted out of epicker-ui.js so the React dialog (ui/pages/epicker/) and the
    tests can share them. Nothing here touches the DOM or the message port.

    The specificity ladder in particular decides which filter the user is
    actually offered, and until it lived here it had no test.

*/

/******************************************************************************/

const reCosmeticAnchor = /^#(\$|\?|\$\?)?#/;

// Eight rungs from "most generic" to "keep everything". The bits read as:
//   0b0001  keep id and :nth-of-type
//   0b0010  keep attribute values
//   0b0100  keep the full hierarchy
//   0b1000  walk ancestors at all
const SPECIFICITIES = [
    0b0000, // remove hierarchy; remove id, nth-of-type, attribute values
    0b0010, // remove hierarchy; remove id, nth-of-type
    0b0011, // remove hierarchy
    0b1000, // trim hierarchy; remove id, nth-of-type, attribute values
    0b1010, // trim hierarchy; remove id, nth-of-type
    0b1100, // remove id, nth-of-type, attribute values
    0b1110, // remove id, nth-of-type
    0b1111, // keep all = most specific
];

/******************************************************************************/

/**
 * Build the eight candidate selector paths for one slot of the cosmetic
 * candidate list, most generic first.
 *
 * @param {string[]} filters cosmetic candidates, each still carrying its `##`
 * @param {number} slot which candidate the user picked
 * @param {boolean} needBody whether a `body >` prefix is required
 * @returns {string[][]} one path array per specificity rung
 */
const candidatePathsForSlot = function(filters, slot, needBody) {
    const candidates = [];

    for ( const specificity of SPECIFICITIES ) {
        const paths = [];
        for ( let i = slot; i < filters.length; i++ ) {
            let filter = filters[i].slice(2);
            // Remove id, nth-of-type.
            // https://github.com/uBlockOrigin/uBlock-issues/issues/162
            //   Mind escaped periods: they do not denote a class identifier.
            if ( (specificity & 0b0001) === 0 ) {
                filter = filter.replace(/:nth-of-type\(\d+\)/, '');
                if (
                    filter.charAt(0) === '#' && (
                        (specificity & 0b1000) === 0 || i === slot
                    )
                ) {
                    const pos = filter.search(/[^\\]\./);
                    if ( pos !== -1 ) {
                        filter = filter.slice(pos + 1);
                    }
                }
            }
            // Remove attribute values.
            if ( (specificity & 0b0010) === 0 ) {
                const match = /^\[([^^*$=]+)[\^*$]?=.+\]$/.exec(filter);
                if ( match !== null ) {
                    filter = `[${match[1]}]`;
                }
            }
            // Remove all classes when an id exists.
            if ( filter.charAt(0) === '#' ) {
                filter = filter.replace(/([^\\])\..+$/, '$1');
            }
            if ( paths.length !== 0 ) {
                filter += ' > ';
            }
            paths.unshift(filter);
            // Stop at any element with an id: these are unique in a web page.
            if ( (specificity & 0b1000) === 0 || filter.startsWith('#') ) {
                break;
            }
        }

        // Trim hierarchy: remove generic elements from the path.
        if ( (specificity & 0b1100) === 0b1000 ) {
            let i = 0;
            while ( i < paths.length - 1 ) {
                if ( /^[a-z0-9]+ > $/.test(paths[i + 1]) ) {
                    if ( paths[i].endsWith(' > ') ) {
                        paths[i] = paths[i].slice(0, -2);
                    }
                    paths.splice(i + 1, 1);
                } else {
                    i += 1;
                }
            }
        }

        if (
            needBody &&
            paths.length !== 0 &&
            paths[0].startsWith('#') === false &&
            paths[0].startsWith('body ') === false &&
            (specificity & 0b1100) !== 0
        ) {
            paths.unshift('body > ');
        }

        candidates.push(paths);
    }

    return candidates;
};

/******************************************************************************/

/**
 * Turn the filter shown in the editor into the line written to My filters: a
 * cosmetic filter gains the hostname, a network filter gains its options.
 *
 * @param {string} filter
 * @param {string} hostname already punycode-decoded by the caller
 * @param {string} [resultsetOpt]
 * @returns {string|undefined}
 */
const userFilterFromCandidate = function(filter, hostname, resultsetOpt) {
    if ( filter === '' || filter === '!' ) { return; }

    if ( reCosmeticAnchor.test(filter) ) {
        return hostname + filter;
    }

    // Assume net filter.
    const opts = [];
    // If no domain is included in the filter, we need the domain option.
    if ( filter.startsWith('||') === false ) {
        opts.push(`domain=${hostname}`);
    }
    if ( resultsetOpt !== undefined ) {
        opts.push(resultsetOpt);
    }
    if ( opts.length !== 0 ) {
        filter += '$' + opts.join(',');
    }
    return filter;
};

/******************************************************************************/

/**
 * The page-side picker appends `##body` to the cosmetic candidates to signal
 * that a `body >` prefix is needed. That marker is not something the user
 * should ever be offered, so it comes off the list and returns as a flag.
 *
 * @param {string[]} cosmeticFilters
 * @returns {{ filters: string[], needBody: boolean }}
 */
const splitBodyMarker = function(cosmeticFilters) {
    const needBody =
        cosmeticFilters.length !== 0 &&
        cosmeticFilters[cosmeticFilters.length - 1] === '##body';
    return {
        filters: needBody ? cosmeticFilters.slice(0, -1) : cosmeticFilters.slice(),
        needBody,
    };
};

/******************************************************************************/

export {
    SPECIFICITIES,
    candidatePathsForSlot,
    reCosmeticAnchor,
    splitBodyMarker,
    userFilterFromCandidate,
};

import type { ReactNode } from 'react';

// Regional-indicator emoji -> bundled PNG flag, same table as upstream
// i18n.patchUnicodeFlags() so list titles render identically.
const flagToCode = new Map<string, string>([
    [ '🇦🇱', 'al' ], [ '🇦🇷', 'ar' ], [ '🇦🇹', 'at' ], [ '🇧🇦', 'ba' ],
    [ '🇧🇪', 'be' ], [ '🇧🇬', 'bg' ], [ '🇧🇷', 'br' ], [ '🇨🇦', 'ca' ],
    [ '🇨🇭', 'ch' ], [ '🇨🇳', 'cn' ], [ '🇨🇴', 'co' ], [ '🇨🇾', 'cy' ],
    [ '🇨🇿', 'cz' ], [ '🇩🇪', 'de' ], [ '🇩🇰', 'dk' ], [ '🇩🇿', 'dz' ],
    [ '🇪🇪', 'ee' ], [ '🇪🇬', 'eg' ], [ '🇪🇸', 'es' ], [ '🇫🇮', 'fi' ],
    [ '🇫🇴', 'fo' ], [ '🇫🇷', 'fr' ], [ '🇬🇷', 'gr' ], [ '🇭🇷', 'hr' ],
    [ '🇭🇺', 'hu' ], [ '🇮🇩', 'id' ], [ '🇮🇱', 'il' ], [ '🇮🇳', 'in' ],
    [ '🇮🇷', 'ir' ], [ '🇮🇸', 'is' ], [ '🇮🇹', 'it' ], [ '🇯🇵', 'jp' ],
    [ '🇰🇷', 'kr' ], [ '🇰🇿', 'kz' ], [ '🇱🇰', 'lk' ], [ '🇱🇹', 'lt' ],
    [ '🇱🇻', 'lv' ], [ '🇲🇦', 'ma' ], [ '🇲🇩', 'md' ], [ '🇲🇰', 'mk' ],
    [ '🇲🇽', 'mx' ], [ '🇲🇾', 'my' ], [ '🇳🇱', 'nl' ], [ '🇳🇴', 'no' ],
    [ '🇳🇵', 'np' ], [ '🇵🇱', 'pl' ], [ '🇵🇹', 'pt' ], [ '🇷🇴', 'ro' ],
    [ '🇷🇸', 'rs' ], [ '🇷🇺', 'ru' ], [ '🇸🇦', 'sa' ], [ '🇸🇮', 'si' ],
    [ '🇸🇰', 'sk' ], [ '🇸🇪', 'se' ], [ '🇸🇷', 'sr' ], [ '🇹🇭', 'th' ],
    [ '🇹🇯', 'tj' ], [ '🇹🇼', 'tw' ], [ '🇹🇷', 'tr' ], [ '🇺🇦', 'ua' ],
    [ '🇺🇿', 'uz' ], [ '🇻🇳', 'vn' ], [ '🇽🇰', 'xk' ],
]);
const reFlags = new RegExp(Array.from(flagToCode.keys()).join('|'), 'gu');

// Text with flag emoji replaced by the bundled flag images.
export function withFlags(text: string): ReactNode {
    if ( reFlags.test(text) === false ) { return text; }
    reFlags.lastIndex = 0;
    const out: ReactNode[] = [];
    let i = 0;
    let n = 0;
    for (;;) {
        const match = reFlags.exec(text);
        if ( match === null ) { break; }
        if ( match.index > i ) { out.push(text.slice(i, match.index)); }
        const code = flagToCode.get(match[0]) ?? '';
        out.push(
            <img key={n++} className="countryFlag" src={`/img/flags-of-the-world/${code}.png`} alt={code} title={code} />,
            ' ',
        );
        i = reFlags.lastIndex;
    }
    if ( i < text.length ) { out.push(text.slice(i)); }
    return out;
}

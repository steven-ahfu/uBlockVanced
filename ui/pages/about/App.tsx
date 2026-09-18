import { TextButton } from 'material-expressive-react/button';
import { AssistChip, ChipSet } from 'material-expressive-react/chips';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../../shared/Icon';
import { IconButton } from '../../shared/IconButton';
import { List, ListItem } from '../../shared/ListItem';
import { icons } from '../../shared/icons';
import { Tooltips } from '../../shared/Tooltip';
import { t, tf } from '../../shared/i18n';
import { send } from '../../shared/vapi';
import { aboutIcons } from './icons';
import { Card } from '../../shared/Card';
import { Pill, Pills } from '../../shared/Pill';

interface AppData { name: string; version: string; canBenchmark?: boolean }

const FORK_REPO = 'https://github.com/SysAdminDoc/uBlockVanced';

interface LinkDef { href: string; label: string; icon: string }

// Rows of link chips; every link opens in a new tab, as upstream about.js does.
function LinkChips({ links }: { links: LinkDef[] }) {
    return (
        <ChipSet className="ubv-about-links">
            {links.map(link => (
                <AssistChip
                    key={link.href}
                    className="ubv-chip"
                    label={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-tip={link.href}
                >
                    <Icon slot="icon" svg={link.icon} />
                </AssistChip>
            ))}
        </ChipSet>
    );
}

interface Credit { what: string; whatURL: string; who: string; whoURL: string; extra?: string }

const credits: Credit[] = [
    { what: 'CodeMirror', whatURL: 'https://codemirror.net/', who: 'Marijn Haverbeke', whoURL: 'https://github.com/marijnh' },
    { what: 'Punycode.js', whatURL: 'https://github.com/mathiasbynens/punycode.js', who: 'Mathias Bynens', whoURL: 'https://github.com/mathiasbynens' },
    { what: 'Metropolis font family', whatURL: 'https://web.archive.org/web/20201013225635/https://github.com/chrismsimpson/Metropolis', who: 'Chris Simpson', whoURL: 'https://github.com/chrismsimpson' },
    { what: 'Inter font family', whatURL: 'https://github.com/rsms/inter', who: 'Rasmus Andersson', whoURL: 'https://github.com/rsms' },
    { what: 'Geist font family', whatURL: 'https://vercel.com/font', who: 'Vercel', whoURL: 'https://github.com/vercel/geist-font' },
    { what: 'JetBrains Mono', whatURL: 'https://www.jetbrains.com/lp/mono/', who: 'JetBrains', whoURL: 'https://github.com/JetBrains/JetBrainsMono' },
    { what: 'FontAwesome font family', whatURL: 'https://fontawesome.com/', who: 'Dave Gandy', whoURL: 'https://github.com/davegandy' },
    { what: 'Material Symbols', whatURL: 'https://fonts.google.com/icons', who: 'Google', whoURL: 'https://github.com/google/material-design-icons' },
    { what: "An implementation of Myers' diff algorithm", whatURL: 'https://github.com/Swatinem/diff', who: 'Arpad Borsos', whoURL: 'https://github.com/Swatinem' },
    { what: 'Regular Expression Analyzer', whatURL: 'https://github.com/foo123/RegexAnalyzer', who: 'Nikos M.', whoURL: 'https://github.com/foo123' },
    { what: 'HSLuv - Human-friendly HSL', whatURL: 'https://github.com/hsluv/hsluv', who: 'Alexei Boronine', whoURL: 'https://github.com/boronine' },
    { what: 'google-ima.js', whatURL: 'https://searchfox.org/mozilla-central/rev/d317e93d9a59c9e4c06ada85fbff9f6a1ceaaad1/browser/extensions/webcompat/shims/google-ima.js', who: 'Mozilla', whoURL: 'https://www.mozilla.org/' },
    { what: 'CSSTree', whatURL: 'https://github.com/csstree/csstree', who: 'Roman Dvornov', whoURL: 'https://github.com/lahmatiy' },
    { what: 'js-beautify', whatURL: 'https://github.com/beautify-web/js-beautify', who: 'Einar Lielmanis', whoURL: 'https://github.com/einars', extra: ', Liam Newman, et al.' },
    { what: 'Flags of the World', whatURL: 'https://flagpedia.net/', who: 'David Krmela', whoURL: 'https://www.davidkrmela.com/' },
];

const reAnchor = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
const plain = (html: string): string => html.replace(/<[^>]+>/g, '');

// Upstream messages that carry markup (aboutCDNs has a link) are split into
// text and Material text buttons, in the order the string writes them, so
// nothing is injected as HTML.
function Prose({ html, className }: { html: string; className?: string }) {
    const parts: ReactNode[] = [];
    let i = 0;
    let n = 0;
    reAnchor.lastIndex = 0;
    for (;;) {
        const match = reAnchor.exec(html);
        if ( match === null ) { break; }
        if ( match.index > i ) { parts.push(plain(html.slice(i, match.index))); }
        parts.push(
            <TextButton key={n++} className="ubv-inline-link" href={match[1]} target="_blank"
                data-tip={t('genericOpenDocumentation')}>
                {plain(match[2])}
            </TextButton>,
        );
        i = reAnchor.lastIndex;
    }
    if ( i < html.length ) { parts.push(plain(html.slice(i))); }
    return <p className={className}>{parts}</p>;
}

export function App() {
    const [ app, setApp ] = useState<AppData | null>(null);
    useEffect(() => {
        send<AppData>('dashboard', { what: 'getAppData' }).then(setApp);
    }, []);

    const productLinks: LinkDef[] = [
        { href: 'https://github.com/gorhill/uBlock/wiki/Privacy-policy', label: t('aboutPrivacyPolicy'), icon: aboutIcons.policy },
        { href: `${FORK_REPO}/releases`, label: t('aboutChangelog'), icon: aboutIcons.history },
        { href: FORK_REPO, label: t('aboutCode'), icon: aboutIcons.code },
    ];
    const communityLinks: LinkDef[] = [
        { href: `${FORK_REPO}/graphs/contributors`, label: t('aboutSourceCode'), icon: aboutIcons.group },
        { href: 'https://crowdin.com/project/ublock', label: t('aboutTranslations'), icon: aboutIcons.translate },
        { href: 'https://github.com/uBlockOrigin/uAssets/graphs/contributors', label: t('aboutFilterLists'), icon: aboutIcons.lists },
    ];
    const cdnLinks: LinkDef[] = [
        { href: 'https://pages.cloudflare.com/', label: 'Cloudflare Pages', icon: aboutIcons.public },
        { href: 'https://pages.github.com/', label: 'GitHub Pages', icon: aboutIcons.public },
        { href: 'https://www.jsdelivr.com/', label: 'jsDelivr', icon: aboutIcons.public },
        { href: 'https://statically.io/', label: 'Statically', icon: aboutIcons.public },
    ];

    return (
        <div className="ubv-page ubv-about">
            <header className="ubv-page-header">
                <div className="ubv-page-copy">
                    <div className="ubv-eyebrow" translate="no">uBlockVanced</div>
                    <h1 className="ubv-title" id="aboutNameVer">{app?.name ?? 'uBlockVanced'}</h1>
                    <p className="ubv-lead">{t('extShortDesc')}</p>
                </div>
                <Pills>
                    <Pill tone="accent" id="aboutVersionBadge" label={app ? tf('aboutVersionBadge', { version: app.version }) : ''} />
                </Pills>
            </header>

            <Card className="ubv-about-section" aria-label={t('aboutSectionProduct')}>
                <div className="ubv-card-header"><h2 className="ubv-card-title">{t('aboutSectionProduct')}</h2></div>
                <LinkChips links={productLinks} />
            </Card>

            <Card className="ubv-about-section" aria-label={t('aboutSectionContributors')}>
                <div className="ubv-card-header"><h2 className="ubv-card-title">{t('aboutSectionContributors')}</h2></div>
                <LinkChips links={communityLinks} />
            </Card>

            <Card className="ubv-about-section" aria-label={t('aboutSectionDependencies')}>
                <div className="ubv-card-header"><h2 className="ubv-card-title">{t('aboutSectionDependencies')}</h2></div>
                <List className="ubv-credits">
                    {credits.map(c => (
                        <ListItem key={c.whatURL} className="ubv-credit">
                            <div slot="headline">{c.what}</div>
                            <div slot="supporting-text">{t('aboutCreditBy')} {c.who}{c.extra ?? ''}</div>
                            <div slot="end" className="ubv-credit-links">
                                <IconButton variant="standard" href={c.whatURL} target="_blank"
                                    data-tip={c.whatURL} aria-label={tf('aboutCreditProject', { name: c.what })}>
                                    <Icon svg={icons.external} />
                                </IconButton>
                                <IconButton variant="standard" href={c.whoURL} target="_blank"
                                    data-tip={c.whoURL} aria-label={tf('aboutCreditAuthor', { name: c.who })}>
                                    <Icon svg={aboutIcons.group} />
                                </IconButton>
                            </div>
                        </ListItem>
                    ))}
                </List>
            </Card>

            <Card className="ubv-about-section" aria-label={t('aboutSectionInfrastructure')}>
                <div className="ubv-card-header"><h2 className="ubv-card-title">{t('aboutSectionInfrastructure')}</h2></div>
                <Prose className="ubv-muted ubv-about-note" html={t('aboutCDNs')} />
                <LinkChips links={cdnLinks} />
                <p className="ubv-muted">{t('aboutCDNsInfo')}</p>
            </Card>

            <p className="ubv-muted ubv-about-footer">{t('aboutCopyright')}</p>
            <Tooltips />
        </div>
    );
}

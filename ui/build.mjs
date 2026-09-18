// uBlockVanced - esbuild driver for the React UI layer (see ui/README.md).
//
//   node ui/build.mjs              build once into dist/ui
//   node ui/build.mjs --release    minified, no sourcemaps
//   node ui/build.mjs --watch      rebuild on change
//   node ui/build.mjs --sync=DIR   also copy dist/ui/* into DIR after each build

import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesDir = path.join(root, 'ui', 'pages');
const outdir = path.join(root, 'dist', 'ui');
const args = process.argv.slice(2);
const watch = args.includes('--watch');
const release = args.includes('--release');
const syncArg = args.find(a => a.startsWith('--sync='));
const syncDir = syncArg ? path.resolve(root, syncArg.slice('--sync='.length)) : null;

const pages = readdirSync(pagesDir).filter(name =>
    existsSync(path.join(pagesDir, name, 'main.tsx'))
);
const legacyPages = new Map([
    [ 'logger-ui', [ 'logger-ui.html', [ 'logger-ui.js', 'logger-ui-inspector.js' ] ] ],
    [ 'element-probe-panel', [ 'element-probe-panel.html', [ 'element-probe-panel.js' ] ] ],
]);
if ( pages.length === 0 ) {
    console.error('ui/build.mjs: no pages found under ui/pages/*/main.tsx');
    process.exit(1);
}

rmSync(outdir, { recursive: true, force: true });
mkdirSync(path.join(outdir, 'js', 'ui'), { recursive: true });

const copyHtml = () => {
    // A page that ships its own .html is a finished React page; the legacy
    // synthesis below is only for pages still rendered by the upstream
    // markup plus a React overlay.
    const ownHtml = new Set();
    for ( const page of pages ) {
        const dir = path.join(pagesDir, page);
        for ( const file of readdirSync(dir) ) {
            if ( file.endsWith('.html') === false ) { continue; }
            cpSync(path.join(dir, file), path.join(outdir, file));
            ownHtml.add(file);
        }
    }
    for ( const [ page, [ html, scripts ] ] of legacyPages ) {
        if ( pages.includes(page) === false ) { continue; }
        if ( ownHtml.has(html) ) { continue; }
        let source = readFileSync(path.join(root, 'src', html), 'utf8');
        for ( const script of scripts ) {
            source = source.replace(
                new RegExp(`\\s*<script(?=[^>]*\\bsrc=\"js/${script}\")[^>]*></script>`),
                ''
            );
        }
        source = source.replace(
            '</head>',
            `    <link rel=\"stylesheet\" href=\"js/ui/${page}.css\">\n</head>`
        ).replace(
            '</body>',
            `<div id=\"root\"></div>\n<script src=\"js/ui/${page}.js\" type=\"module\"></script>\n</body>`
        );
        writeFileSync(path.join(outdir, html), source);
    }
    if ( syncDir !== null && existsSync(syncDir) ) {
        cpSync(outdir, syncDir, { recursive: true });
        console.log(`ui: synced into ${path.relative(root, syncDir)}`);
    }
};

const ctx = await esbuild.context({
    entryPoints: Object.fromEntries(
        pages.map(page => [ page, path.join(pagesDir, page, 'main.tsx') ])
    ),
    outdir: path.join(outdir, 'js', 'ui'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: [ 'firefox115', 'chrome110' ],
    jsx: 'automatic',
    minify: release,
    sourcemap: release ? false : 'inline',
    legalComments: 'none',
    loader: { '.svg': 'text' },
    define: { 'process.env.NODE_ENV': release ? '"production"' : '"development"' },
    logLevel: 'info',
    plugins: [ {
        name: 'ubv-copy-html',
        setup(build) {
            build.onEnd(result => {
                if ( result.errors.length === 0 ) { copyHtml(); }
            });
        },
    } ],
});

if ( watch ) {
    await ctx.watch();
    console.log('ui: watching...');
} else {
    await ctx.rebuild();
    await ctx.dispose();
}

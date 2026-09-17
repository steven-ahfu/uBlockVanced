# ui/ — React + Material 3 Expressive layer

This directory holds the fork's React UI. It is designed so that rebasing on
upstream uBlock Origin stays cheap:

1. **Upstream files are never edited for UI work.** `src/*.html`, `src/js/*.js`
   and `src/css/*.css` stay as upstream (plus the fork's earlier changes). All
   React code lives here, under `ui/`, which upstream does not have.
2. **Overlay at build time.** `npm run build:ui` bundles `ui/pages/<page>/main.tsx`
   into `dist/ui/js/ui/<page>.js` (+ `.css`) and copies `ui/pages/<page>/*.html`
   into `dist/ui/`. `tools/copy-common-files.sh` then copies `dist/ui/*` over the
   package directory *after* the upstream files, so a React page replaces the
   upstream page of the same name (e.g. `popup-fenix.html`) without touching it
   in `src/`. Delete a page directory under `ui/pages/` and the upstream page is
   back.
3. **Same messages, same ids.** React pages talk to the background through the
   global `vAPI.messaging` with the exact `{ what: ... }` messages the upstream
   pages send, so `src/js/messaging.js` needs no React-specific handlers. Where
   upstream CSS drives layout by id/attribute (`#panes`, `#firewall`,
   `body[data-more]`), the React tree keeps those ids so upstream CSS still
   applies and the fork's overlay CSS keeps working.
4. **Shared runtime stays upstream's.** `js/vapi*.js`, `js/theme.js` and the
   locale files are loaded by the page exactly as before; `ui/shared/` only wraps
   them with typed helpers.

## Layout

```
ui/
  build.mjs            esbuild driver: --watch, --release, --sync=<dir>
  tsconfig.json
  globals.d.ts         types for the vAPI globals and *.svg imports
  shared/
    vapi.ts            typed wrappers over the global vAPI (messaging, storage)
    i18n.ts            t('key') -> localized string
    theme.ts           M3 typography + Material tokens bootstrap
    tokens.css         Rosé Pine --ctp-* slots -> --md-sys-color-* tokens
    Icon.tsx           <Icon svg={...}/> renders a Material Symbols SVG in <md-icon>
    icons.ts           the SVGs this UI uses, imported from @material-symbols/svg-400
  pages/
    popup/             replaces src/popup-fenix.html
      popup-fenix.html
      main.tsx
      ...
```

## Commands

```
npm run build:ui                 # one-off build into dist/ui
npm run dev:ui                   # watch + sync into dist/build/uBlock0.firefox
npm run typecheck                # tsc --noEmit over ui/
make firefox                     # runs build:ui first, then packages as before
```

Development loop: `make firefox` once, load `dist/build/uBlock0.firefox/manifest.json`
as a temporary add-on, then `npm run dev:ui` and press Reload in about:debugging
after each change.

## Rules for new pages

- One directory per upstream page, named after the page. Keep the upstream file
  name for the HTML so links from other pages keep working.
- Load the same `js/vapi*.js` + `js/theme.js` scripts the upstream page loads,
  then the bundle: `<script src="js/ui/<page>.js" type="module">`.
- Use `material-expressive-react` components for every control. Bespoke widgets
  (the firewall matrix, CodeMirror) keep upstream ids/classes so upstream CSS
  still applies.
- Strings come from `t('key')` (existing `_locales` keys). Add new keys to
  `src/_locales/en/messages.json` as usual.

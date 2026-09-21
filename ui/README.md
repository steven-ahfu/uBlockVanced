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
    tokens.css         Rosé Pine --ctp-* slots -> --md-sys-color-* tokens,
                       plus the fork's --ubv-* radius, size and motion scale
    controls.css       geometry + hover motion for the shared controls
    metrics.ts         the --ubv-* tokens as inline styles, for components
                       whose wrapper writes inline geometry (ToggleButton)
    Icon.tsx           <Icon svg={...}/> renders a Material Symbols SVG in <md-icon>
    icons.ts           the SVGs this UI uses, imported from @material-symbols/svg-400
    Card.tsx           Card -> md-outlined-card, the page card
    Pill.tsx           Pill / Pills -> md-assist-chip in an md-chip-set
    IconButton.tsx     one 40px icon button for the whole UI
    ListItem.tsx       List / ListItem -> md-list / md-list-item (rows with
                       a control in slot="end")
    Tile.tsx           ribbon tiles: ToggleButton / FilledTonalButton
    Tooltip.tsx        M3 plain tooltips for any element with data-tip
    CloudWidget.tsx    the cloud-sync card, shared by four pages
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
- Use `material-expressive-react` components for **every** UI element, controls
  and surfaces alike: no hand-rolled `<button>`, `<input>`, `<select>`, `<a>`
  used as a button, `<span onClick>`, pill, card or list. CodeMirror is the one
  bespoke widget, and it keeps upstream ids/classes so upstream CSS applies.
- Import from the package subpath (`material-expressive-react/button`,
  `/chips`, ...) except `Card`, `Toolbar` and the `button-group` components:
  those subpaths ship no `index.js` in 0.2.1, so import them from the package
  root `'material-expressive-react'`.
- Reach for `ui/shared/` first (Card, Pill, IconButton, ListItem, Tile,
  Tooltip). Sizes, radii and hover motion come from the `--ubv-*` tokens in
  `tokens.css`; never hard-code a pixel size for a control.
- A control's host element must be its own hover box: make the Material
  container transparent through its tokens and paint the host, so one
  transition (`--ubv-hover-transition`) covers mouse-in and mouse-out.
- CodeMirror hosts are `display: block` and full width. A flex-row host makes
  the editor resize while the user scrolls.
- Strings come from `t('key')` (existing `_locales` keys). Add new keys to
  `src/_locales/en/messages.json` as usual.

# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Codex, etc.) working in this repository.

## What this is

uBlockVanced is a fork of uBlock Origin (Manifest V2) maintained at `SysAdminDoc/uBlockVanced`. This repo (`steven-ahfu/uBlockVanced`) is a downstream fork of that fork. Additions over upstream uBO: the **Element Probe** DevTools panel, a **Catppuccin** theme system, procedural-filter tooling, CSP-compatible cosmetic mode, filter-list update diffs, resizable logger columns, per-site user filters, stale-filter cleanup.

## Git rules (read first)

- **Commit as the repo owner, never as Claude/AI.** Author must be `steven-ahfu <claude@ahfu.cc>`. No `Co-Authored-By: Claude` trailers, no AI session links in commit messages. Set once per checkout:
  ```
  git config user.name steven-ahfu
  git config user.email claude@ahfu.cc
  ```
- **Branches:**
  - `upstream` tracks `upstream/master` (remote `upstream` = `https://github.com/SysAdminDoc/uBlockVanced.git`). Never commit to it; only `git pull` it to sync.
  - `main` is where all fork work happens. Merge or rebase `upstream` into `main` to pull upstream changes.
  - Feature branches: no prefix, short name (`logger-fix`, `probe-i18n`). Not `feat/...`, not `claude/...`.
- Commit message style: conventional-ish, lowercase, imperative (`fix: harden logger column resizing`, `feat: show filter list update diffs`, `chore: release 0.3.1`).

## Commands

```
npm install              # dev deps (eslint only); Node >=22, npm >=11
npm run lint             # eslint over src/js, platform, *.json (excludes lib/, npm/)
npm test                 # node --test over tests/*.test.js
node --test tests/user-filters.test.js            # single test file
node --test --test-name-pattern='subdomains' tests/user-filters.test.js   # single test by name
npm run build:ui         # bundle the React UI (ui/) into dist/ui; make targets run this automatically
npm run dev:ui           # esbuild watch + sync into dist/build/uBlock0.firefox (Reload in about:debugging)
npm run typecheck        # tsc --noEmit over ui/
make chromium            # dist/build/uBlock0.chromium (also: firefox, opera, thunderbird)
make crx                 # signed CRX3 of the chromium build; key in uBlockVanced.pem (gitignored, see below)
make packages            # all release files: chromium.zip, chromium.crx, firefox.xpi, opera.zip, thunderbird.xpi
make clean               # rm dist/build, node_modules
```

**Do not try to verify UI changes in Chrome.** The extension is Manifest V2 and Chrome no longer runs it, so neither the Claude-in-Chrome tools nor a local harness page count as verification. Build (`make firefox`), run `npm run typecheck`, `npm run lint`, `npm test`, and hand the build to the maintainer to load in Firefox via about:debugging.

Pages that have been ported to React (see `ui/README.md`) need `make firefox` (or `npm run build:ui`) and are loaded from `dist/build/uBlock0.firefox`; the remaining upstream pages still work when `src/` is loaded unpacked. Builds only copy files (`tools/copy-common-files.sh` + `platform/<browser>/*`) and generate a manifest via `tools/make-<browser>-meta.py`. First build clones uAssets into `dist/build/uAssets` (needs network). Version lives in `dist/version` and is stamped into manifests at build time; `package.json` and the README badge carry it too. Releases are automatic: bump `dist/version`, `package.json`, the README badge, and add a `CHANGELOG.md` section, then push to `main`; `.github/workflows/release.yml` sees the untagged version, builds all packages, tags the commit, and publishes the release. Never push tags by hand. Requires `openssl` and `zip`; `tools/pack-crx3.py` has no Python deps.

**CRX signing key.** The extension ID is derived from the RSA key, so the same key must sign every release. It lives in three places, all outside git:
- `uBlockVanced.pem` at the repo root: what `make crx` / `make packages` read locally. Generated on first run if absent.
- `.env` at the repo root (gitignored): holds the same PEM as `CRX_PRIVATE_KEY="..."` (multi-line, double-quoted) as a backup copy. Restore the key with the snippet below.
- GitHub repo secret `CRX_PRIVATE_KEY` on `steven-ahfu/uBlockVanced`: `.github/workflows/release.yml` writes it to `uBlockVanced.pem` before `make packages`. Without it CI generates a throwaway key and the extension ID changes.

Current extension ID: `ongbahmlaoecaggpjgeojpgahgeojnmo`. Never commit `.env` or any `.pem`. To rotate or re-seed: `make crx` (generates a key if missing), then `gh secret set CRX_PRIVATE_KEY < uBlockVanced.pem` and refresh `.env`. To restore `uBlockVanced.pem` from `.env`:
```
sed -n '/^CRX_PRIVATE_KEY="/,/"$/p' .env | sed -e 's/^CRX_PRIVATE_KEY="//' -e 's/"$//' > uBlockVanced.pem
```

Tests are plain `node:test` + `node:assert/strict` and import ES modules directly from `src/js/`. Only pure modules (no `chrome.*`, no `vAPI`) are testable this way. `package.json` lists test files explicitly; add new files there.

## Architecture

### Layout
- `src/` — the extension as shipped (HTML pages, `js/`, `css/`, `_locales/`, `lib/` third-party). `src/js/lib` and `src/lib` are vendored; don't lint or edit.
- `platform/common/` — `vapi*.js`: the browser-API abstraction layer. `vapi-background.js` (extension process), `vapi-client.js` (content scripts), `vapi-common.js` (both). `platform/{chromium,firefox,opera,...}/` hold per-browser `manifest.json` and overrides copied over `common` at build time.
- `platform/mv3/` — uBOL (MV3 Lite). Untouched by the fork; ignore unless working on it.
- `ui/` — React + Material 3 Expressive UI layer, bundled by esbuild into `dist/ui` and overlaid onto packages (see below).
- `tools/` — build scripts. `tests/` — unit tests. `docs/tests/` — browser-run filter test pages.

### Extension process (background)
Entry is `src/background.html` → `src/js/background.js` defines the `µBlock` singleton (`µb`), then `start.js` boots everything. Core engines are separate modules that `µb` composes:
- `static-net-filtering.js` — network filters (with `hntrie.js`/`biditrie.js` for hostname/token tries, wasm variants in `src/js/wasm/`).
- `static-filtering-parser.js` — parses filter list syntax into the engines. `static-ext-filtering.js` + `cosmetic-filtering.js` / `html-filtering.js` / `scriptlet-filtering.js` / `httpheader-filtering.js` — "extended" (non-network) filters.
- `dynamic-net-filtering.js`, `hnswitches.js` — per-site dynamic rules and switches. `redirect-engine.js` — `$redirect` resources.
- `storage.js` / `assets.js` / `cachestorage.js` — filter list fetching, caching, compiling. `pagestore.js` / `tab.js` — per-tab state. `traffic.js` — webRequest handlers.
- `messaging.js` — the single switchboard for UI↔background messages. Every UI page/content script talks to the background through `vAPI.messaging` with `{ what: '...' }` requests handled here. Add new message types here.

### Content side
`contentscript.js` (+ `contentscript-extra.js` for procedural cosmetic filters) runs in pages, asks the background for cosmetic/scriptlet payloads, and injects them. Scriptlets live in `src/js/scriptlets/` and `src/js/resources/`.

### UI pages
Each `src/*.html` has a matching `src/js/*.js` and `src/css/*.css`. Dashboard tabs (`settings`, `1p-filters`, `3p-filters`, `dyna-rules`, `whitelist`, `advanced-settings`) are iframes inside `dashboard.html`. Theming is applied by `theme.js` (dark is the default in this fork) with palette tokens in `src/css/themes/` and `--ctp-*` CSS variables; the `catppuccinPalette` hidden setting swaps palettes.

### Fork-specific: React + Material 3 Expressive UI (`ui/`)
The user-facing pages are being ported to React 19 with `material-expressive-react` (wrappers over `@material/web`, https://github.com/prudhviraj5/material-expressive-react). Read `ui/README.md` first.

**ALL new UI elements MUST be rendered with material-expressive-react components** (Button/ToggleButton, IconButton, Checkbox, Switch, Chips, Textfield, Select, Dialog, ...). No hand-rolled `<button>`, `<input>`, or styled `<span>` controls, even when a plain element would be easier to style. Size, shape and colour are adjusted through the component's `style`/token variables (see `ui/shared/metrics.ts`) and `--ubv-*` tokens, never by replacing the component. If, in the course of other work, you notice a file that renders UI without these components, update that file to use them as part of that work.

The rules that keep upstream rebases cheap:
- **Never edit upstream `src/*.html`, `src/js/*.js` or `src/css/*.css` for UI work.** React pages live in `ui/pages/<page>/` and are overlaid onto the package at build time by `tools/copy-common-files.sh`; delete a page directory and the upstream page is back.
- React pages send the same `{ what: ... }` messages the upstream page sends, through the global `vAPI.messaging`; `messaging.js` needs no React-specific handlers.
- Keep upstream ids/attributes where upstream CSS drives layout (`#panes`, `#firewall`, `body[data-more]`).
- Shared building blocks live in `ui/shared/`: `Card` (md-outlined-card), `Pill`/`Pills` (md-assist-chip in an md-chip-set), `IconButton` (one 40px size for the whole UI), `List`/`ListItem` (md-list, with the row's control in `slot="end"`), `Tile`, `Tooltip` (`data-tip`), `Icon`, `icons`, `Flags`, `i18n`, `vapi`, `broadcast`, `tokens.css`, `controls.css`, `metrics.ts`. Reuse them; do not duplicate a control inside a page.
- **Import gotcha:** `Card`, `Toolbar`, `ConnectedButtonGroup`, `ConnectedButton`, `OutlinedSegmentedButtonSet` and `OutlinedSegmentedButton` must be imported from the package root `'material-expressive-react'`. Their subpaths ship no `index.js` in 0.2.1, so typecheck passes but esbuild fails. Everything else imports from its subpath.
- `ui/shared/tokens.css` maps the `--ctp-*` palette slots onto `--md-sys-color-*`, so palettes keep working without component changes.
- A control's host element is its own hover box: make the Material container transparent through its tokens and paint the host, so one transition covers mouse-in and mouse-out. Hover motion is global: `--ubv-hover-transition` (500ms ease-in-out), hover surface `--ubv-hover-surface`. Never gate a hover rule on `.desktop` — the popup drops that class in portrait mode.
- CodeMirror hosts are `display: block` and full width (`ui/shared/page.css`). A flex-row host makes the editor resize as the user scrolls.
- Icons are Material Symbols SVGs inlined at build time (no icon font, CSP unchanged).
Ported (15 directories under `ui/pages/`): popup, dashboard, settings, 3p-filters, 1p-filters, dyna-rules, whitelist, advanced-settings, about, support, asset-viewer, document-blocked, no-dashboard, logger-ui, element-probe-panel. CodeMirror stays a bespoke widget created in each page's `useEditor.ts`/`useMergeView.ts`. Dashboard pages import `ui/shared/page.css` for the page frame, cards, pills and rows. Scales in `ui/shared/tokens.css`, and nothing else: radius `--ubv-radius-card|control|chip`, spacing `--ubv-gap`/`--ubv-pad`, sizes `--ubv-control` (40) / `--ubv-button` (48, page actions and the popup power control) / `--ubv-tile` (48, one square glyph) / `--ubv-icon` (20). Open conversion work is tracked in `.agents/m3e-audit.md`.

### Fork-specific: Element Probe
A DevTools panel (`manifest.json: devtools_page` → `devtools-page.html` → `devtools-page.js` registers the panel → `element-probe-panel.html`/`.js`). The panel entry point only orchestrates; logic is in `src/js/element-probe/`:
- `state.js` — shared state object, `$`, i18n, status/log helpers.
- `page-scripts.js` — code strings evaluated in the inspected page via `chrome.devtools.inspectedWindow.eval()` (selector generation, class classification, shadow DOM scan, highlighting). This is the largest module; it runs in page context, not the panel, so it can't import anything.
- `inspect.js` — wraps `inspectedWindow.eval` and drives an inspection.
- `ui.js` — renders selector/procedural lists, builds the final filter text (`generateFilter`).
- `history.js` — filter history in `chrome.storage.local`; persists filters via `chrome.runtime.sendMessage({ what: 'createUserFilter' })` and reads via `getUserRules`.
- `picker.js`, `frames.js` — hover-to-pick and iframe/YouTube targeting.

Pure helpers factored out for testing: `filter-export.js`, `filter-list-diff.js`, `user-filters.js`, `user-filter-stats.js`, and `classify-classes` (see `tests/`).

### Fork-specific: CSP-compatible mode
Hidden setting `cspCompatibleMode` (Advanced Settings) flows `messaging.js` → `contentscript.js` (`vAPI.cspCompatibleMode`) → `cosmetic-filtering.js`, routing cosmetic styles through constructable stylesheets instead of inline `<style>`.

## Conventions

- ESLint config is authoritative: 4-space indent, `eqeqeq`, `sort-imports` (import specifiers sorted), ES modules. Run `npm run lint` before committing.
- uBO house style: `if ( cond ) {` with inner spaces, `µb` for the background singleton, `vAPI` for browser APIs, no direct `chrome.*` in shared code (Element Probe panel is the exception because DevTools APIs aren't wrapped by vAPI).
- Upstream (Raymond Hill) code keeps its license header; fork files use a short `uBlockVanced - ...` header. Mark fork changes inside upstream files with a `// uBlockVanced:` comment so upstream merges are easier.
- User-facing strings go in `src/_locales/en/messages.json`; Element Probe uses `data-i18n` attributes resolved by `renderI18n()`.
- `CHANGELOG.md` is updated per release; `ROADMAP.md` holds only actionable items. Keep them in sync when finishing roadmap work.
- Issues: this repo's tracker is for the fork only. Filter list problems go to uAssets, core uBO bugs to uBlock-issues (see `CONTRIBUTING.md`).

## Working with the reader (ADHD)

The maintainer has ADHD. Follow the `i-have-adhd` skill (source: https://raw.githubusercontent.com/ayghri/i-have-adhd/refs/heads/main/.cursor/skills/i-have-adhd/SKILL.md). These rules apply to every response, for the whole session, until told "stop adhd mode". Condensed:

1. **Lead with the next action.** First line is something the reader can do: a command, a path, a snippet. Context after, if at all.
2. **Number multi-step work.** One bounded action per step. Fewest steps that work.
3. **End with one concrete next action** doable in under two minutes.
4. **Suppress tangents.** Finish the first issue. Offer a second one as a separate question at the end, never mid-answer.
5. **Restate state every turn.** "Step 3 of 5 done: X. Next: Y." Use the harness task/plan tool for multi-step work so the checklist does the restating.
6. **Specific time estimates.** "About 15 minutes if tests cover this, an afternoon if not." Never "some work".
7. **Make completed work visible.** Say what now works and how to try it.
8. **Matter-of-fact errors.** State cause and fix. No "Uh oh".
9. **Cap visible lists at 5 items** per group, most relevant first. Keep the rest internally; show on request.
10. **No preamble, no recap, no closing pleasantries.** Start with the answer, stop when it's done.

Break the rules only for: an explicit "explain"/"walk me through" (then explain fully, with headers); a destructive action (confirm first); a debug spiral of 3+ "still broken" turns (stop, name the wrong assumption, ask one diagnostic question); real ambiguity (one short question); or when the harness system prompt requires otherwise.

Pre-send check: delete the first sentence if it announces what you're about to do, the last if it recaps or asks "anything else?", any sidebar, any empty hedge, any idiom. Then verify the first line says what to do next and the last line says what just happened.

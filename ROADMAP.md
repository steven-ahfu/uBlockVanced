# ROADMAP

Actionable work only. Historical and completed roadmap material is archived in CHANGELOG.md; blocked work is kept in Roadmap_Blocked.md.

Last reconciled against the code on 2026-09-20. Most of the previous list had
shipped without being ticked off; each item below was re-checked against the
files named in its own "Evidence" line rather than trusted.

## Actionable Items

- [ ] P0 — Verify the React element picker in Firefox
  Why: 0.4.0 rewrote the picker dialog wholesale (`ui/pages/epicker/`). It is MV2, so Chrome cannot run it and there is no local harness; the packaged build is the only thing that exercises the `MessageChannel` handshake, the drag, the sliders and the sea.
  Touches: load `dist/build/uBlock0.firefox` via `about:debugging`, right-click → Block element.
  Acceptance: dialog appears; Pick / Preview / Create work; both sliders move the filter; Selectors and Probe tabs both populate; Escape quits; the page is not left dimmed.
  Complexity: S (a careful pass, not code)

- [ ] P1 — AMO submission
  Why: the fork is only distributed as GitHub release artifacts. Three things block a listing, none started.
  Evidence: `platform/firefox/manifest.json` gecko id is `uBlockVanced@sysadmindoc.dev` (upstream's namespace, and AMO ids are permanent); the React UI is esbuild-bundled so AMO requires a source upload with build instructions; `package.json` author/repo/bugs still point at `SysAdminDoc`.
  Risk: the name may be refused under AMO's "no names implying affiliation" policy.
  Complexity: M

- [ ] P2 — Import from AdGuard / ABP cosmetic syntax
  Why: the operator compatibility table exists but nothing consumes it for import.
  Evidence: `src/js/filter-export.js` maps `:contains-own()`, `:-abp-properties()`, `:matches-property-regex()` and friends to notes; `normalizeFilterImportText()` does not translate them.
  Acceptance: pasting an AdGuard or ABP cosmetic filter into My filters either converts it or is rejected with the note explaining why it cannot cross over.
  Complexity: M

- [ ] P3 — Retire the non-React picker fallback
  Why: `src/js/epicker-ui.js`, `src/web_accessible_resources/epicker-ui.html` and `src/css/epicker-ui.css` are now dead in every packaged build; they only run when `src/` is loaded unpacked. Two implementations of one dialog will drift.
  Blocked on: P0 above. Do not delete the fallback until the React picker is confirmed working.
  Complexity: S

- [ ] P3 — Theme tokens that still need a class
  Why: seven custom properties are declared only under a `.dark` selector, so a document that paints before `js/theme.js` runs has no value for them.
  Evidence: `--scrollbar-track` and the six `--popup-cell-*-surface-rgb` colours in `src/css/themes/default.css`. All are cosmetic and confined to extension pages, which is why they were left when 0.3.8 moved the palette to bare `:root`.
  Acceptance: `tests/theme-palette.test.js` can assert zero class-only tokens.
  Complexity: S

## Shipped since this list was last accurate

Ticked off after checking the code, not the changelog:

- React + Material 3 Expressive port — all 16 pages including the element picker (0.4.0)
- Export user filters as shareable JSON with per-rule notes — `src/js/filter-export.js`, `tests/filter-export.test.js`
- Per-site enable/disable of user filters — `src/js/user-filters.js`, `tests/user-filters.test.js`
- Stale filter cleanup, 30 zero-match days — `src/js/user-filter-stats.js`, `tests/user-filter-stats.test.js`
- Theme palette object, Catppuccin Latte/Frappé/Macchiato/Mocha swappable — `catppuccinPalette` hidden setting, `src/css/themes/default.css`
- CSP-compatible mode — `cspCompatibleMode` hidden setting, `src/js/cosmetic-filtering.js`
- Element Probe panel i18n — 82 `ep*` keys in `src/_locales/en/messages.json`
- Modularize `element-probe-panel.js` — 1822 lines down to 76; logic lives in `src/js/element-probe/`
- Filter list update diff view — `ui/pages/3p-filters/components/FilterDiffPanel.tsx`, `tests/filter-list-diff.test.js`
- Resizable logger columns — `ui/pages/logger-ui/`

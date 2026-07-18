# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Simplefolio: a static, single-page developer portfolio template. Plain HTML/SCSS/JS bundled with Parcel — no framework, no build-time templating, no backend. The entire site is `src/index.html` plus the assets it links.

## Commands

```bash
npm start          # dev server with HMR at http://localhost:1234/
npm run build       # production build to dist/ (source map + minified)
```

There is no test suite, linter script, or type checker configured. `prettier` is a devDependency (config in `.prettierrc`, currently empty/defaults) but there's no `format` script — run it directly if needed: `npx prettier --write .`.

Node version is pinned in `.nvmrc` (16.14.2).

## Architecture

**Single entry point, section-based page.** `src/index.html` is the entire DOM: a fixed `.site-header`, then one `<section>` per portfolio area in order — hero, about, experience, projects, contact — then a footer. `src/index.js` and `src/styles.scss` are the only two assets it links directly; Parcel resolves everything else (SCSS partials, JS imports, images) through those two files' import graphs.

**JS is a set of independent init functions, no shared state.** `src/index.js` just imports and calls each feature's init function once at load:
- `scripts/scrollReveal.js` — wraps the ScrollReveal library (loaded via CDN `<script defer>` in `index.html`, exposed as the global `ScrollReveal`) using config from `data/scrollRevealConfig.js`. That config is a plain array of `{ element, animation }` pairs — add an entry here to animate a new element on scroll; don't touch `scrollReveal.js` itself.
- `scripts/tiltAnimation.js` — wraps `vanilla-tilt` (npm dependency) over any `.js-tilt` element (used for project thumbnails, tied to `data-tilt-*` attributes in the HTML).
- `scripts/themeToggle.js` — light/dark toggle. Reads/writes `data-theme` on `<html>` and persists to `localStorage["theme"]`. An inline `<script>` in the `<head>` of `index.html` applies the stored/preferred theme *before first paint* to avoid a flash of the wrong theme — if you change the storage key or attribute name, update both places.

There's no bundler-level module boundary beyond ES imports — each script's init is called exactly once, synchronously, at the bottom of `index.js`.

**SCSS is manually ordered via a single `styles.scss` manifest** (`src/styles.scss`), following ITCSS-style layering: vendors → abstracts (mixins/variables/theme/helpers) → base → components → layout → sections. Partials are never auto-imported — adding a new `.scss` file requires adding its `@import` to `styles.scss` in the correct layer position.

- `sass/abstracts/_variables.scss` — SCSS variables (colors, font sizes). `$primary-color` / `$secondary-color` are the two-color gradient the whole template is themed around.
- `sass/abstracts/_theme.scss` — light/dark CSS custom properties (`--bg-color`, `--text-color`, etc.), keyed off the `[data-theme="dark"]` attribute set by `themeToggle.js`. Components should consume `var(--...)` custom properties for anything that changes between themes, and SCSS `$variables` for anything that doesn't.
- `sass/abstracts/_mixins.scss` — `respond($breakpoint)` is the mobile-first/max-width media query mixin used everywhere for responsiveness (breakpoints: `phone-xs`, `phone`, `tab-port-sm`, `tab-port`, `tab-land`, `big-desktop`).
- `sass/sections/*.scss` — one file per `<section>` in `index.html`, matching by name (`_hero.scss` ↔ `#hero`, etc.).
- `sass/layout/*.scss` — cross-section chrome (header, footer, generic section spacing).

**Content is meant to be edited directly in the markup**, not pulled from data files or CMS — project cards, experience entries, and copy all live as literal HTML in `index.html` with `[bracketed placeholder]` text and `Todo:` comments marking what a user of this template should replace. When asked to add a new project/experience entry, duplicate the existing repeating block (`.row` for projects, `.experience-wrapper__item` for experience) rather than introducing a data-driven abstraction.

## Deployment

`.github/workflows/gh-pages.yml` builds on push/PR to `main` and publishes `dist/` to GitHub Pages. Note the default branch in git is `master`, not `main` — this workflow only fires on a branch literally named `main`.

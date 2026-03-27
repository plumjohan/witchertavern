# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Lint
npm run lint          # Run both JS and CSS linters
npm run lint:js       # ESLint only
npm run lint:css      # Stylelint only

# Tests
npm test              # Run all tests
npm run test:watch    # Continuous test mode
npm run test:file <path>       # Run a single test file with coverage
npm run test:file:watch <path> # Watch a single test file

# Build
npm run build:lit     # Bundle Lit framework via esbuild
```

## Architecture

This is an **AEM (Adobe Experience Manager) Edge Delivery Services** project using a buildless, block-based architecture.

### Core Framework

- **`scripts/ak.js`** — Main framework. Provides `loadBlock()`, `loadArea()`, `getConfig()`/`setConfig()`, `getMetadata()`, `getLocale()`, `decorateLink()`, and `loadStyle()`. The entry point for all page rendering logic.
- **`scripts/scripts.js`** — App initialization. Sets site config (hostnames, locales, link blocks), registers the `decorateArea` hook, and integrates DA preview and quick-edit tools.
- **`scripts/utils/`** — Utility modules for icons, images, environment detection, lazy loading, observers, etc.

### Block System

Each block lives in `blocks/{name}/{name}.js` + `blocks/{name}/{name}.css`. Blocks are loaded dynamically by `loadBlock()` when the browser encounters a matching element class in the DOM. There are 12 pre-built blocks: `card`, `header`, `footer`, `hero`, `columns`, `section-metadata`, `table`, `youtube`, `schedule`, `fragment`, `advanced-tabs`, `article-list`.

### Page Structure

AEM documents render as:
```
<main>
  <div>  ← section
    <div class="block-name">  ← block (loaded as blocks/block-name/block-name.js)
    <p>, <h1-h6>, etc.        ← default content
  </div>
</main>
```

`section-metadata` blocks control CSS classes applied to their parent section.

### Auto-Blocks

`ak.js` transforms certain link patterns into blocks automatically:
- Links to `/fragments/` → `fragment` block
- Links to `/schedules/` → `schedule` block
- YouTube URLs → `youtube` block

### Cloudflare Worker

`workers/website/` is a Cloudflare Worker that proxies requests to AEM. Configured via `wrangler.toml`, it routes schedule manifests, structured content (`/dasc/*.json`), and blocks draft URLs.

### Localization

Seven locales are configured in `scripts/scripts.js` (en, de, es, fr, hi, ja, zh). `getLocale()` in `ak.js` resolves locale from the URL path prefix. `decorateLink()` applies locale prefixes to internal links.

### Design System

CSS custom properties are defined in `styles/styles.css`:
- **Spacing tokens**: `--spacing-xs` (4px) through `--spacing-xxl` (48px)
- **Color palette**: 8 base colors × 9 tints (100–900)
- **Grid**: 12-column with responsive gutters
- **Buttons**: `accent`, `primary`, `secondary`, `negative` variants (+ `-outline` suffix)
- **Typography**: Montserrat variable font (100–900 weight)
- **Color schemes**: `light-dark()` CSS function; stored in localStorage

### CSS Conventions

- **Mobile-first**: Write base styles for mobile, then enhance with `@media (width >= 600px)` (tablet) and `@media (width >= 900px)` (desktop). Never use `max-width` queries.

### Testing

Tests use Web Test Runner + Chai + Sinon. Test files live in `test/` and mirror the `scripts/` and `blocks/` structure.

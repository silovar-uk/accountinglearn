# Browser regression baseline

## Purpose

This suite verifies the user journeys most likely to break while the case schema and learning engine evolve. It complements the existing content and accounting checks by running the real application in Chromium.

## Covered journeys

- first-run onboarding and learning-mode selection
- home and case-library navigation
- CASE 1 launch and page-map locking
- answer checking, attempt history, local persistence, and reload recovery
- mobile financial-value selection and calculator use
- horizontal-overflow checks on home, case, and calculator screens
- service-worker activation and offline app-shell reopening
- browser console and uncaught page errors

## Projects

- `desktop-chromium`: desktop Chrome-compatible viewport
- `mobile-chromium`: Pixel 7 emulation

## Commands

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

The local server is implemented in `scripts/serve.mjs`, so browser tests do not depend on a system-specific Python command.

## Failure evidence

CI retains Playwright traces, screenshots, videos, and the HTML report for seven days when the browser job fails.

## Boundaries

This baseline does not yet cover every CASE 1 page or Safari/WebKit. Those are added only after the core Chromium suite is stable, to keep failures understandable and maintenance deliberate.

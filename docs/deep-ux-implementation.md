# Deep UX implementation

## Goal

The second UI pass treats Accounting Quest as a learning product rather than a static case viewer. It adds explicit progress semantics, recovery paths, mobile calculation, durable data movement, and offline resilience.

## Implemented layers

1. **Learning state** — daily activity, streaks, attempt history, learning modes, smart resume, import validation, and versioned state migration.
2. **Case navigation** — a desktop case outline, modal page map, locked future pages, exact incomplete requirements, and exit confirmation.
3. **Answer experience** — attempt counts, hints, richer feedback, retry without losing history, and first-try accuracy.
4. **Mobile calculation** — numbers selected from financial documents enter a safe calculator with operator precedence, history, and answer-field insertion.
5. **Data portability** — export, validated import, automatic pre-import backup, and state normalization.
6. **PWA quality** — installable PNG icons, Web App Manifest, service worker app-shell caching, online/offline feedback, and a no-JavaScript fallback.
7. **Accessibility** — focusable headings, live announcements, keyboard answer submission, escape behavior, color-independent status copy, and reduced-motion settings.

## Completion semantics

- Reading pages are complete on view.
- Exercise pages require every non-proposal step to be checked.
- Proposal pages require every required field to contain non-whitespace text.
- Future pages remain locked until preceding pages are complete.
- Opening the ending no longer marks the case complete. Completion is written only through the final action after all required items are done.

## Validation

`npm run check` performs JavaScript syntax checks, content validation, accounting consistency tests, UI asset checks, PWA checks, and calculator-engine tests.

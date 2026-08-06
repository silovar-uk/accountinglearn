# CASE 1 stability audit

## Scope

This pass deliberately avoids adding a second case. It stabilizes the content contract and removes CASE 1-only assumptions before schema v2 work begins.

## Fixed in this pass

- The catalog manifest now uses the exact case ID stored in the case JSON.
- Formula assistance is resolved from `formula.nodes`, financial rows, and referenced document fields. Step IDs no longer contain hard-coded calculation values.
- Case validation now checks IDs, page order, document and value references, option references, formulas, journal balance, proposal fields, scoring totals, ending content, cash forecasts, and cash-flow bridges.
- Manifest validation checks case paths, statuses, exact IDs, release order, duplicate entries, and published library metadata.
- Runtime asset auditing compares HTML references and published case paths against the service-worker cache.
- The service-worker cache is versioned to v4 so existing installations receive the stabilized engine.

## Compatibility

- The browser storage key is unchanged.
- Existing answers, attempts, proposal text, streaks, and case progress are preserved.
- The published case path is unchanged.
- The case's internal ID is unchanged; only the incorrect manifest alias is corrected.

## Remaining structural work

The repository still uses a base UI layer, a UI override layer, and a deep UX layer. Consolidating those layers should happen as a separate refactor after browser regression coverage is added. Mixing that rewrite into this stability pass would make failures harder to isolate.

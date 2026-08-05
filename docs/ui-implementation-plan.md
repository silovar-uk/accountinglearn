# UI/UX implementation plan

## Goal

Accounting Quest should feel light and encouraging without copying another product's visual identity. The core rule is **one page, one learning purpose, one obvious next action**.

## Information hierarchy

1. Home: resume the current case immediately.
2. Case library: show availability, progress, completion, time, and topic.
3. Case player: remove the main bottom navigation and prioritize the page, answers, and page controls.
4. Foundations: provide short reference lessons connected to cases.
5. Review: return mistakes to the relevant page.
6. Records: separate page progress from understanding score.

## Visual system

- Deep green expresses professional judgment and trust.
- Mint is used for learning states and selected controls.
- Gold is reserved for momentum and major calls to action.
- Coral is limited to errors and destructive actions.
- Cards use moderate rounding and restrained elevation.
- All key tap targets are at least 44px.

## Mobile behavior

- Financial statements switch from wide tables to period cards below 620px.
- The case footer stays above the safe area and replaces the global navigation.
- Required questions must be checked before the next page is enabled.
- Proposal pages require all required fields before continuing.
- Text inputs and journal entries collapse to one column.

## Feedback

- Correct and incorrect states use icon, label, border, and background—not color alone.
- Feedback explains the reason, not only the result.
- Page progress and score are shown separately.
- A case is marked complete only when all required steps are checked.

## Brand assets

- Custom ledger-and-growth favicon in SVG.
- 192px, 512px, and 180px PNG variants.
- Web app manifest and mobile metadata.

## Validation

- JavaScript syntax checks for all scripts.
- Existing case content validation and numeric reconciliation tests.
- Static asset reference audit.
- Manual mobile-width and desktop-width browser review when the environment permits.

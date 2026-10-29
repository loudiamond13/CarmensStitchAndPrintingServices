# Phase 7 - UI Review
*Created: 2026-10-29T10:00:00-05:00 · Updated: 2026-10-29T06:25:00-05:00*

**Audited:** 2026-10-29
**Baseline:** docs/CSPS-UI-SPEC.md (Audit Log) plus abstract 6-pillar standards. No phase UI-SPEC exists.
**Scope:** Phase 7 is a backend phase. The only frontend change is the admin Audit Log extension for order events (auditCopy.ts, AuditDetail.tsx, AuditLogPage.tsx). Order list and detail pages are not penalised.
**Screenshots:** not captured (no dev server started, by owner rule on the shared machine). Code-only audit.
**Interaction captures:** off

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Plain, consistent labels. No dashes. A few ambiguous labels ("Item added") and a possible "Not set" vs EmptyValue mismatch. |
| 2. Visuals | 2/4 | Order number shown under the "Done to" column header. Order-snapshot line is one dense comma string. |
| 3. Color | 3/4 | No color changes. Nothing hardcoded added. |
| 4. Typography | 3/4 | No new classes. Reuses existing detail classes. |
| 5. Spacing | 3/4 | No new spacing. Reuses existing detail classes. |
| 6. Experience Design | 2/4 | Action filter grows to about 45 more options with no search. Unreadable values drop silently. Behavior is code-derived only. |

**Overall: 16/24**

## Top 3 Priority Fixes

1. **Order number sits in the "Done to" column** (AuditLogPage.tsx:109) - the header says a person, the cell shows `ORD-...`. Staff may read it as a person. Add an "Order" column or rename the header to "Done to / Order". Also render `EmptyValue` when both are null.
2. **Action filter now has about 45 more options in one select** (auditCopy.ts, groups "Orders" and "Order lists") - slow to scan on a phone. Keep the optgroups, but consider a type-ahead or an "Orders" quick filter. Check that the select group order matches the UI-SPEC A1 list.
3. **Silent omission of unreadable change lines** (auditCopy.ts, `valuePair` returns null) - an entry can show fewer changes than happened with no hint. Show a fallback sentence such as "A value changed" so staff know a line was hidden. Also give order sub-entry labels the order context where the list is read alone ("Item added" has no "order" in it; use "Order item added" etc.).

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- All new labels are plain English and in sentence case (auditCopy.ts action table, `TEXT_FIELD_SENTENCES`, status labels). Seven statuses match D-01 (Pending, Mockup, In Production, Ready, Delivered, Completed, Cancelled).
- Money uses `formatPeso`, dates use the Manila formatter. Text field changes say only that the field changed, never the text (05 D-40). Good.
- OR-4 check: no em or en dash in auditCopy.ts, AuditDetail.tsx or AuditLogPage.tsx (0 matches).
- WARNING: "Item added", "Payment added", "Discount added" lack the word "order", so they are unclear in a mixed log. "Order expense" vs "Order expense category" is clear enough.
- WARNING: `NOT_SET = 'Not set'` is typed text in a sentence. This is fine in prose (it matches the hidden text of EmptyValue) but is a second source of the same words.
- Snapshot copy "total ... paid ... balance ..." is clear. The page intro now mentions orders. Good.

### Pillar 2: Visuals (2/4)
- WARNING: AuditLogPage.tsx:109 puts `item.orderNumber` in the "Done to" column. This mixes two kinds of value in one column and the header becomes wrong for order rows.
- AuditDetail.tsx adds an "Order" row at the top of the detail list. Good, and it gives the order number a proper label there.
- WARNING: `describeAuditOrderSnapshot` is one comma-joined line (number, status, total, paid, balance). It is hard to scan at 320 px. A label-value layout would read better.
- No icon-only buttons added.

### Pillar 3: Color (3/4)
- No color classes added in the diff. No hardcoded colors. No accent drift. Not a 4 because nothing could be checked visually (no screenshots).

### Pillar 4: Typography (3/4)
- No new font size or weight classes. Existing `audit*Classes` are reused. Not visually verified.

### Pillar 5: Spacing (3/4)
- No new spacing or arbitrary values. The long order sentences may wrap in the narrow detail cell; not verified at 320 px.

### Pillar 6: Experience Design (2/4)
- Loading, error and empty states of the Audit Log page are unchanged and not regressed (tests updated in AuditLogPage.test.tsx and AuditDetail.test.tsx).
- WARNING: Select with about 45 added options; no search. See fix 2.
- WARNING: Unreadable values are dropped silently. See fix 3.
- `isStatedValueAction` regex means a new `order-*` action added later falls through to the old/new format. This needs a test when new actions are added. Existing tests cover the current set.
- Interaction states (focus, hover) were not captured. The findings are code-derived only.
- No registry audit needed (no third-party blocks in scope).

## Files Audited
- web/src/modules/admin/auditCopy.ts (and .test.ts)
- web/src/modules/admin/components/AuditDetail.tsx (and .test.tsx)
- web/src/modules/admin/pages/AuditLogPage.tsx (and .test.tsx)
- web/src/modules/admin/components/showcase/Phase5Demos.tsx
- web/src/modules/admin/services/auditLogService.test.ts
- Not scored: web/src/types/api.generated.ts

## Finding Outcomes

| Finding | Outcome |
|---|---|
| Fix 1: order number in the "Done to" column | Fixed in quick 261029-87p (9840244f): own "Order" column (D-79). |
| Fix 2: long Action select | Fixed in quick 261029-87p (0f4c00c5): browser-only "Group" select shortens the list (D-80). Type-ahead not built. |
| Fix 3: unreadable change lines dropped; labels without "order" | Fixed in quick 261029-87p (8ff4514b): "<Field> changed" fallback (D-81) and "Order ..." labels (D-82). |
| Dense one-line order snapshot | Deferred to Phase 8 (order screens), when the order detail layout is designed. |
| Second "Not set" text source | Deferred: harmless, matches the EmptyValue hidden text; revisit with Phase 8 copy. |
| `isStatedValueAction` regex needs a test for new actions | Deferred: covered by current tests; add a test when new actions are added. |
| Visual check at 320, 390 and 1440 px | Open for the owner (no dev server run in this audit). |

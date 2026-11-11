---
phase: "10"
created: 2026-11-09T10:00:00-06:00
updated: 2026-11-09T10:30:00-06:00
---

# Phase 10: UI Review

*Created: 2026-11-09T10:00:00-06:00 · Updated: 2026-11-09T10:30:00-06:00*

**Audited:** 2026-11-09 (full pass; replaces the earlier shallow pass)
**Baseline:** `10-UI-SPEC.md` (approved 2026-11-05), with `docs/CSPS-UI-SPEC.md` App. C for the inherited recipes and the parked owner items in `999.6-.../DECISIONS.md`
**Screenshots:** not captured (code-only audit by instruction; the orchestrator captures them separately)
**Interaction captures:** off (workflow.ui_interaction_capture is false). Every interaction finding below is code-derived.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Screen copy matches the contract line by line; the failure toasts and the network line do not use the spec words |
| 2. Visuals | 2/4 | The dashboard scrolls sideways at 320 px with the spec's own demo figures (P10-BL-06), and window footers push Cancel off screen (P10-BL-16) |
| 3. Color | 3/4 | Accent only on reserved elements, no hard-coded colors; the strip label is muted where the Label role is ink |
| 4. Typography | 3/4 | Only declared and inherited sizes; one extra clamp size on the balance card |
| 5. Spacing | 3/4 | New code uses 2 px, 12 px and 72 px steps that the contract reserves for reused recipes |
| 6. Experience Design | 3/4 | Every query view has loading, error and empty states with tests; the strip's small buttons lack the declared 44 px tap area |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **UI-01: strip buttons are 36 px tall with no 44 px tap area.** Staff on phones (the main users) can miss Transfer, View Ledger and Try Again. Add `hitAreaClasses` to the three `sm` buttons in `MoneyStrip.tsx` and to `TransferButton` when `size="sm"`, and add a test that the tap box is at least 44 px.
2. **UI-02: the dashboard scrolls sideways at 320 px with a six-digit figure (P10-BL-06).** It breaks the binding "no horizontal scroll" rule with the spec's own demo values (₱126,450.00). Get the owner's layout ruling (option A, one KPI column at small phones, is recommended), then build it and un-fixme `web/e2e/dashboard.spec.ts:111`.
3. **UI-03: window and dialog footers push Cancel past the left edge at 320 px (P10-BL-16).** Cancel in Remove Permanently starts 30 px off screen. Get the owner's ruling (option A, let the shared footer wrap, is recommended) and fix it once in the shared footer.

---

## Findings

Severity: **priority** (fix before ship) or **minor**. "Parked" means an open owner item already exists; the finding stays so it is not lost.

| ID | Sev | Pillar | File:line | Spec section | Finding | Fix |
|---|---|---|---|---|---|---|
| UI-01 | priority | 6 | `web/src/modules/admin/components/MoneyStrip.tsx:65-73, 96-100`; `TransferButton.tsx:48, 56` | Spacing → Control sizes ("strip buttons `sm` (36px drawn) inside the existing invisible 44px tap area"); CLAUDE.md touch targets ≥ 44 px | `Button`/`ButtonLink` `sm` is `h-9` and `buttonClasses` adds no tap area. Transfer, View Ledger and the strip's Try Again pass no `hitAreaClasses`. Only Hand Over does (`StaffBalancesTable.tsx:125`). No test checks the size. | Pass `className={hitAreaClasses}` on those three, or add it in `TransferButton` for `sm`; add a size test. |
| UI-02 | priority | 2 | `web/src/modules/admin/components/dashboard.recipe.ts:19`; `web/e2e/dashboard.spec.ts:111` | UI Considerations → overflow "Very large figures in KPIs"; CLAUDE.md "no horizontal scroll" | Page is about 347 px wide at 320 px with a six-digit Collected figure. Parked as P10-BL-06, test held as `test.fixme`. | Owner ruling on P10-BL-06, then build it. |
| UI-03 | priority | 2 | Shared window footer (`OrderWindow`, `ConfirmDialog`) | Interaction → Windows and dialogs; Responsive 320 px | Footer buttons never wrap, so long labels push Cancel off screen (Remove Permanently 30 px, Hand Over 2 px). Parked as P10-BL-16. | Owner ruling, then `flex-wrap` (or stack) in the shared footer. |
| UI-04 | minor | 1 | `web/src/modules/admin/hooks/useTransferAction.ts:70-75`; `moneyCopy.ts` (no failure titles) | Copywriting → Toasts "Action failed: danger, persists, Couldn't {record the transfer, delete the transfer, remove the transfer}" | No danger toast with these titles exists. Failures show in the window banner or the dialog line with the generic mapper copy. Inline is arguably better, but it is not what the contract says. | Either add the three titles to `moneyCopy.ts` and use them as the inline line's lead, or record an owner ruling that inline replaces the toast. |
| UI-05 | minor | 1 | `web/src/utils/describeHttpError.ts:14-15, 21` | Copywriting → Validation "Network or timeout: Couldn't save. Check your connection, then try again."; "Server error: Something went wrong. Reference: {traceId}" | The transfer window shows "Couldn't reach the server. Check your internet connection and try again." and "Something went wrong. Please try again. Reference: …". This is the shared mapper (P2), so the phase spec and the code disagree. | Either reword the spec to the mapper lines (owner note) or pass phase-specific network copy to the window. |
| UI-06 | minor | 1 | `moneyCopy.ts` `deleteTransfer.checking` | Copywriting → Loading regions | The Delete dialog's balance check is read out as "Loading staff balances…". Parked as P10-BL-14. | Keep or reword per owner. |
| UI-07 | minor | 2 | `web/src/modules/admin/components/StaffBalancesTable.tsx:118` | Component Inventory → Row actions (Recent orders and ledger actions carry a matching `title`) | The All Staff eye link has `label` but no `title`, so sighted mouse users get no tooltip. Recent orders (`RecentOrdersCard.tsx:200`) and ledger actions do set it. | Add `title={COPY.viewLedgerName(row.name)}`. |
| UI-08 | minor | 2 | `money.recipe.ts:52-55, 58-61` | D1 MoneyStrip "beside it a Small line"; M1 header | The "Nothing on hand to transfer." line takes its own row, not beside the button. Parked as P10-BL-15 (option A keeps it). | Owner ruling. |
| UI-09 | minor | 3 | `money.recipe.ts:24` | Typography → Label (14/600) uses `--ink`; Color table | The strip label "Your money on hand" is `text-ink-muted`. The Label role and the KpiCard overline are not muted text in the contract. | Use `text-ink`, or record it as a choice. |
| UI-10 | minor | 3 | `money.recipe.ts:45` | Typography → Small; Color → Destructive | The strip failure line is Small in `--danger`. Allowed as an error colour, but its size and tone are parked as P10-BL-15. | Owner ruling. |
| UI-11 | minor | 4 | `money.recipe.ts:77` | Typography → Declared set (16, 14, 13 only; anything else from a reused recipe) | The balance card adds `clamp(22px, 13.5cqi, 40px)` for long figures. It copies the KpiCard plan 06-18 clamp, but the spec lists that clamp only for KPIs and the strip. | Cite plan 06-18 as the reused recipe in a `SPEC-DEVIATION` note, or move the clamp into `Money size="lg"`. |
| UI-12 | minor | 5 | `money.recipe.ts:103` | Spacing xs "Ledger title to sub line" = 4 px | `ledgerDetailsClasses` uses `gap-0.5` (2 px). | Use `gap-1`. |
| UI-13 | minor | 5 | `money.recipe.ts:191` | Spacing (new code uses 4, 8, 16, 24, 32, 48 only) | The Transfers note cell uses `gap-0.5` (2 px). | Use `gap-1`. |
| UI-14 | minor | 5 | `money.recipe.ts:97` | Spacing: 12 px allowed only inside reused recipes | `ledgerBarClasses` `pb-3` (12 px) is new code. | Use `pb-2` or `pb-4`. |
| UI-15 | minor | 5 | `money.recipe.ts:167, 174, 177` | Same | The Delete warning `mt-3 p-3`, the check-failed line `mt-3` and the Remove details box `mt-3` are 12 px steps in new code (the details box padding `p-4` is correct). | Use `mt-4` and `p-4` (or `mt-2`). |
| UI-16 | minor | 5 | `dashboard.recipe.ts:51` | App. C `.s-status-list` padding top `--space-2` (8 px) | `statusListClasses` uses `pt-4` (16 px), so there is more room under the card head than App. C. | Use `pt-2`, or note the change as a deviation. |
| UI-17 | minor | 5 | `money.recipe.ts:134` | Spacing scale | The All Staff phone card name keeps a fixed 72 px (`pg-phone:pr-18`) for the buttons. A larger text size could still overlap. Parked as P10-BL-15. | Owner ruling (option B, buttons on their own row, removes it). |
| UI-18 | minor | 5 | `money.recipe.ts:171` | Spacing scale | The warning icon is nudged down `mt-0.5` (2 px). Optical alignment only. | Accept, or align with `items-center`. |
| UI-19 | minor | 6 | `web/src/modules/admin/components/TransferModal.tsx:243` | Interaction → Validation "On submit, then live (P2, spec §10)" | `mode: 'onBlur'` shows errors when a field is left, before the first submit. Noted under P10-BL-15 but not ruled. | Use `mode: 'onSubmit'` (`reValidateMode: 'onChange'`), or get a ruling. |
| UI-20 | minor | 6 | `TransferButton.tsx:56-62` | Interaction → Disabled Transfer "with its reason as visible text tied by `aria-describedby`" | While the figure loads or has failed, the button is `aria-disabled` with no description. Parked as P10-BL-19. | Point `aria-describedby` at the strip's loading or failure line (option A). |
| UI-21 | minor | 6 | `TransferModal.tsx:129-134` | States: every loading slot has a named `LoadingRegion` | Until the business today arrives, the window shows only a bare `SkeletonText` with no live label and no description. | Wrap it in `LoadingRegion` (for example with `things="staff"`, which reads "Loading staff…"). |
| UI-22 | minor | 6 | `web/src/modules/admin/pages/StaffMoneyPage.tsx:80-82` | M2 header | While the person loads, the title is an `aria-hidden` skeleton with no `h1` and no status text. Parked under P10-BL-12. | Owner ruling; or render `h1` "Money" while loading. |
| UI-23 | minor | 6 | `IncomeExpenseCard.tsx` (sub line) | D3 range switch | "Last 12 months" changes before the 12 months arrive, and an all-zero empty state is not dimmed. Parked as P10-BL-19. | Owner ruling (option A). |
| UI-24 | minor | 2 | `web/src/modules/admin/components/LedgerTable.tsx` | UI Considerations → overflow "Tables on tablet and phone" | Found in screenshots: at 768 px the My Money ledger frame is about 646 px wide but the table keeps its 680 px tablet floor, so the Balance column (and Actions for a Manager) is clipped at the card edge with no cue that it scrolls. No edge fade or scroll hint exists anywhere in the project. | Pass the existing `fitTablet` option of `ResponsiveTable` (no 680 px floor); the Details column already wraps. |

### Allowed by a ruling or the spec (not flagged)

- Chart refetch dims by colour (`--surface-2`), not opacity: allowed by the P2 refetch rule and D-02 (`dashboard.recipe.ts:48`).
- `SegmentedControl` 32 px segments: allowed by P2 D-31 O-8.
- 12 px and 20 px in `.s-card-h`, `.s-card-b`, `.s-status-*`, the phone KPI gap and the phone panel gap (`pg-phone:gap-5`): allowed by Spacing → Declared exceptions and App. C.
- Inline `style={{ '--bar-w': … }}` on the status bar: allowed by the P2 inline style rule row added in this spec.
- The client subtraction in the Delete warning: named in the spec (D-33), ruling pending as P10-BL-18.
- Plain "Cancel" in dialogs and the bare "Transfer" label: kept by the checker sign-off (08 D-57, D-58, D-46).
- An empty ledger on another person's page has no body line: parked as P10-BL-12.

---

## Outcomes

Every finding has one recorded outcome: **fixed** (quick 261109-c4l), **closed as allowed** by a named section, or **accepted by owner** (D-107 or D-108, both 2026-11-09). Commits: code c0438e17 (dashboard and the shared footer) and d69ac35b (money screens); the docs commit holds this file. Pillar scores above are the review's own and are not rescored.

| ID | Outcome | Evidence |
|---|---|---|
| UI-01 | Fixed | d69ac35b: `MoneyStrip.test.tsx` (every `hitAreaClasses` token on Transfer, View Ledger and Try Again; the `md` header Transfer has none) and the `@dashboard` browser test "the money strip's Transfer and View Ledger have a 44px tap area" (`::before` at least 44 px, drawn 36 px) |
| UI-02 | Fixed | c0438e17, D-107 P10-BL-06 A: one KPI column at 420 px and below (`dashboard.recipe.node.test.ts`); `test.fixme` is a normal test again and passes with the 320 px no-sideways-scroll check in all five browser projects |
| UI-03 | Fixed | c0438e17, D-107 P10-BL-16 A: `modalFootClasses` has `flex-wrap` (`overlays.recipe.node.test.ts`), D-107 rule group in `rulings.css` (`rulings.test.ts`), and the Manager money sweep at 320 px checks every footer button lies inside the window |
| UI-04 | Accepted by owner (D-108) | Code kept: failures show inline. 10-UI-SPEC.md Copywriting → Toasts now says so |
| UI-05 | Accepted by owner (D-108) | Code kept: the shared `describeHttpError` lines. 10-UI-SPEC.md Copywriting → Validation now quotes them |
| UI-06 | Accepted by owner (D-107) | P10-BL-14: today's "Loading staff balances…" wording stays; no code change |
| UI-07 | Fixed | d69ac35b: `StaffBalancesTable.test.tsx` (the eye link `title` equals its accessible name) |
| UI-08 | Accepted by owner (D-107) | P10-BL-15: the reason line keeps its own row; no code change |
| UI-09 | Fixed | d69ac35b: `MoneyStrip.test.tsx` and `money.recipe.node.test.ts` (the strip label is `text-ink`) |
| UI-10 | Accepted by owner (D-107) | P10-BL-15: the failure line keeps its size and tone; no code change |
| UI-11 | Closed as allowed | 10-UI-SPEC Typography → Declared set ("anything else comes from a reused recipe"): `clamp(22px, 13.5cqi, 40px)` is the plan 06-18 KpiCard long-figure clamp, same value; no code change |
| UI-12 | Fixed | d69ac35b: `money.recipe.node.test.ts` (`ledgerDetailsClasses` is `gap-1`) |
| UI-13 | Fixed | d69ac35b: `money.recipe.node.test.ts` (`transferNoteCellClasses` is `gap-1`) |
| UI-14 | Fixed | d69ac35b: `money.recipe.node.test.ts` (`ledgerBarClasses` is `px-5 pt-4 pb-4`) |
| UI-15 | Fixed | d69ac35b: `DeleteTransferDialog.test.tsx` and `money.recipe.node.test.ts`. The warning now uses the P9 partial-failure banner recipe that 10-UI-SPEC § Color names (`orderPhotosBannerClasses`), so its 12/16 px padding and 12 px gap are inherited; the check-failed line and the remove details box sit 16 px under the message (`mt-4`) |
| UI-16 | Fixed | c0438e17: `dashboard.recipe.node.test.ts` (`statusListClasses` has `pt-2`, App. C `.s-status-list`) |
| UI-17 | Accepted by owner (D-107) | P10-BL-15: the 72 px name reserve on the All Staff phone card stays; no code change |
| UI-18 | Fixed | d69ac35b: `DeleteTransferDialog.test.tsx` (the warning icon is 20 px in the 20 px line with no `mt-0.5`) and the 16 px margins above (see UI-15) |
| UI-19 | Accepted by owner (D-108) | Code kept: the Transfer form checks a box when you leave it. 10-UI-SPEC.md Interaction Contract → Validation now says so |
| UI-20 | Fixed | d69ac35b, D-107 P10-BL-19 A part 2: `MoneyStrip.test.tsx` (Transfer is described by the strip's loading line, then its failure line; no new wording) |
| UI-21 | Fixed | d69ac35b: `TransferModal.test.tsx` (while the business today is unknown the body is a busy `LoadingRegion` that says "Loading staff…") |
| UI-22 | Accepted by owner (D-107) | P10-BL-12 lists "while a person's money page loads, fails or finds no one, the tab reads 'Money · CSPS Admin' and the page has no main heading" among the choices kept, and D-107 keeps today's wording and layout. The review's own fix (an h1 "Money" while loading) would add a heading word, a copy change the owner did not make |
| UI-23 | Fixed | c0438e17, D-107 P10-BL-19 A part 1: `IncomeExpenseCard.test.tsx` (the sub line and the empty message keep the shown range until the new months arrive; the empty message dims by colour only while the other range loads) |
| UI-24 | Fixed | d69ac35b: `LedgerTable.test.tsx` (no 680 px floor) and the `@money` browser test "the ledger fits its card at 768px for a Manager and an Admin" (frame holds its content, Balance inside the card, page does not scroll sideways) |

## Detailed Findings

### Pillar 1: Copywriting (3/4)

I checked every row of the Copywriting Contract against `dashboardCopy.ts` and `moneyCopy.ts`. These all match: the greeting, the subline, the actions, the strip, the KPI labels and all feet (including "None due this week · {m} overdue" and "1 entry · top: …"), the chart legend and tooltip words (D-50, D-104), the status card and footer, Recent orders, M1, the tabs, the balance card, the ledger titles, the result lines and "Not counted", All Staff, Transfers, M2 not found, both window modes, the hints, placeholders and validation lines, the confirm dialogs, and the toasts. The three audit labels in `auditCopy.ts:139-141` also match. The P6 picker words come from `EXPENSES_COPY`, as the spec says. I found no em dash or en dash in `web/src/modules/admin` or the chart. The score is held at 3 by UI-04 and UI-05: the failure wording users see on a failed transfer, delete or remove is not the contracted copy. UI-06 is parked.

### Pillar 2: Visuals (2/4)

Focal order matches the spec: the greeting `h1`, then the strip, the KPI row, `.s-dash` (the chart before the status card at 1023 px and below) and Recent orders. There is one primary button per view (New Order on D1, Transfer on M1, none on M2). Icon-only row actions carry row-scoped names. The score is 2 because the binding responsive rule fails at 320 px with realistic figures (UI-02), and the shared footer clips at 320 px (UI-03). Both are parked, but both are visible defects on the smallest supported width. UI-07 and UI-08 are minor.

### Pillar 3: Color (3/4)

Accent use in phase files: `bg-accent-soft`/`text-accent-ink` on the wallet tile (`money.recipe.ts:17`), `text-accent-ink` on the ledger order links and person links (`:114`, `:140`), and `bg-accent` on the Delivered bar (`dashboard.recipe.ts:73`). All are on the reserved list. `primary` appears only on the one primary button per view. There are no hex or `rgb()` values. Negative figures use `tone="danger"` with U+2212. Text pairs I computed: muted on `--danger-soft` is 6.18:1 (Blush) and 8.07:1 (Espresso); the zero dim on `--surface` is 5.78:1 and 6.19:1. All pass. UI-09 and UI-10 are minor.

### Pillar 4: Typography (3/4)

New code writes only 14 px (400 and 600) and reuses the 13, 22, 24 and 20 px inherited looks (`.s-card-h`, the strip figure from P8 D-92, the status counts). There is no new weight utility beyond 400, 600 and the inherited 700. UI-11 (the extra clamp size) is the one item outside the declared set.

### Pillar 5: Spacing (3/4)

The layout widths and gaps match App. C: `.s-kpis` 16 px with 12 px on phones, `.s-dash` 24 px with 2fr 1fr, status rows 128 | 1fr | 32 px (116 | 28 on phones), and the strip at 16 px padding and gap with `min-h-16`. The contract says new Phase 10 elements use 4, 8, 16, 24, 32 and 48 only. UI-12 to UI-18 break that in seven small places. None of them breaks a layout.

### Pillar 6: Experience Design (3/4)

State coverage is strong. Every query view has loading, error with Try Again, and empty states as specified, and each component test file covers them, with axe checks in each (counts from the test files: KPI row 21 tests, status card 21, Recent orders 20, chart card 30, strip 33, balance card 19, ledger card 32, All Staff 21, Transfers card 28, transfer window 55, Delete 27, Remove 15). The other contract items are in place: Transfer is disabled with a visible reason at or below zero, the delete check shows a skeleton with the confirm off, 409 and 404 are handled, focus moves through `useRowFocus`, and Admin limits come from loader redirects and dropped params. The score is held at 3 by UI-01, a declared 44 px rule missed on the dashboard's main personal action, and by UI-19 to UI-21.

---

## Registry Safety

Not applicable: shadcn is not initialized and the spec lists no registry.

---

## Files Audited

- Spec and plans: `10-UI-SPEC.md` (full), `10-CONTEXT.md`, `10-VERIFICATION.md`, `10-01` to `10-21` PLAN and SUMMARY, `999.6-.../DECISIONS.md` (P10-BL-01 to 20), `docs/CSPS-UI-SPEC.md` App. C recipes
- Copy and schemas: `web/src/modules/admin/dashboardCopy.ts`, `moneyCopy.ts`, `moneySchemas.ts`, `auditCopy.ts`, `expensesCopy.ts` (Paid by words)
- Pages: `web/src/modules/admin/pages/DashboardPage.tsx`, `MoneyPage.tsx`, `StaffMoneyPage.tsx`
- Components: `DashboardKpiRow.tsx`, `IncomeExpenseCard.tsx`, `OrdersByStatusCard.tsx`, `RecentOrdersCard.tsx`, `MoneyStrip.tsx`, `TransferButton.tsx`, `MoneyOnHandCard.tsx`, `LedgerCard.tsx`, `LedgerTable.tsx`, `StaffBalancesTable.tsx`, `TransfersCard.tsx`, `TransfersTable.tsx`, `TransferModal.tsx`, `DeleteTransferDialog.tsx`, `RemoveTransferDialog.tsx`, `dashboard.recipe.ts`, `money.recipe.ts`
- Shared: `web/src/components/data/IncomeExpenseChart.tsx`, `components/navigation/Sidebar.tsx`, `components/actions/button.recipe.ts`, `components/layout/layout.recipe.ts`, `modules/admin/sections.ts`, `routes.tsx`, `hooks/useTransferAction.ts`, `hooks/useTransferDeletion.ts`, `utils/describeHttpError.ts`, `ui/base.css` tokens
- Tests: state and axe coverage counts from the component test files above; `web/e2e/dashboard-sweep.spec.ts`, `money-sweep.spec.ts`

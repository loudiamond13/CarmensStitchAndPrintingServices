# Phase 7: Drafted Amendments for the Owner
*Created: 2026-10-28T09:55:00-05:00 · Updated: 2026-10-28T10:30:00-05:00*

**Status:** Approved by the owner on 2026-10-28 (approve-all, ruling D-39 in `07-CONTEXT.md`). Every line below was applied as drafted, with `<date you approve>` read as 2026-10-28. The extra criterion 2 clause in section 7 was kept. Whether refunds on a soft-deleted order count toward money on hand was left open (section 6 says nothing about it) and is parked in the STATE.md Owner backlog.

**Why this exists:** Your Phase 7 rulings (2026-10-27 and 2026-10-28) changed what some requirement lines say. This file shows each line as it reads today, the new wording, and the decisions behind it. When you approve, the new wording goes in, each line gets a dated owner note, and Phase 7.1 is added to the roadmap.

**How the dated note will look:** each changed line ends with `(owner, <date you approve>, D-xx)`. The `<date you approve>` below is filled in on approval.

Source of every decision: `.planning/phases/07-order-domain-api/07-CONTEXT.md`.

## 1. ORD-05 (D-12, D-13; D-11 unchanged)

**What changes:** the "overpayment rule across all mutation types" is dropped. Only a payment above the balance is refused. Other edits may leave a customer credit, and a refund clears it.

**Current line (verbatim):**

> - [ ] **ORD-05**: Staff can update order details and add/edit/remove items, payments, discount(s) and order expenses. Each change revalidates invariants (quantity > 0, unit price ≥ 0, description 1–200 chars, payment > 0 and not future-dated in business time, percent 0–100, discount ≤ items total, overpayment rule across all mutation types) and recomputes totals server-side ⚑ C-1, OD-4, C-38

**Proposed line:**

> - [ ] **ORD-05**: Staff can update order details and add/edit/remove items, payments, discount(s) and order expenses. Each change revalidates invariants (quantity > 0, unit price ≥ 0, description 1–200 chars, payment > 0 and not future-dated in business time, percent 0–100, discount ≤ items total, a payment above the remaining balance is refused) and recomputes totals server-side. Removing an item, lowering a quantity or price, or adding or raising a discount after payment may push the balance below ₱0.00. That is allowed: the order then shows a customer credit (the amount paid over the new total), and a refund clears it (ORD-18) ⚑ C-1, OD-4, C-38 (owner, <date you approve>, D-12, D-13)

**Decisions carried:** D-11 (a payment above the balance is refused, OD-4 of 2026-10-13), D-12 (other changes may leave a credit), D-13 (a refund clears the credit).

## 2. ORD-06 (D-26 to D-28)

**What changes:** delete becomes a soft delete that both roles can do. Only Managers see deleted orders, restore them, or delete them permanently. The type-the-order-number confirmation moves to the permanent delete.

**Current line (verbatim):**

> - [ ] **ORD-06**: Staff can delete an order through a cascade confirmation that shows child counts and requires typing the order number. Deletion removes all children in one transaction and schedules its images for storage cleanup ⚑ OD-5, OD-6

**Proposed line:**

> - [ ] **ORD-06**: Staff can delete an order. A delete is a soft delete that both Admins and Managers can do: the order and all its parts disappear from every list, total and balance, but the rows stay. Only Managers see the Deleted orders view, restore an order (it counts again everywhere), and delete an order permanently. A permanent delete keeps the cascade confirmation that shows child counts and requires typing the order number. It removes the order and all its children in one transaction and schedules its images for storage cleanup once order images exist ⚑ OD-5, OD-6 (owner, <date you approve>, D-26, D-27, D-28)

**Decisions carried:** D-26 (soft delete), D-27 (both roles may soft-delete), D-28 (Managers only: view, restore, delete permanently; type-the-number confirm; one transaction; image cleanup).

**Note:** ORD-06 stays mapped to Phase 8 in the traceability table. Phase 7 builds the server side only. No mapping changes.

## 3. ORD-13 (D-18)

**What changes:** the six fixed types become a Manager-editable list that starts with the six. Items are not linked to the price list.

**Current line (verbatim):**

> - [ ] **ORD-13**: Each order item has a product type (the 6 fixed types) and a free-text size/variant ⚑ C-44

**Proposed line:**

> - [ ] **ORD-13**: Each order item has a product type chosen from the Manager-editable product type list (it starts with the six: Basketball Jersey, Volleyball Jersey, Moto Riding Jersey, Long Sleeves, Polo Shirt and Custom Design) and a free-text size/variant. Items are not linked to the price list ⚑ C-44 (owner, <date you approve>, D-18)

**Decisions carried:** D-18 (Manager-editable list, foreign key from items, no price-item link). D-19 and D-20 (the list rules and the Phase 8 Settings sections) are not repeated in the line.

## 4. ORD-17 (D-01 to D-05, D-38)

**What changes:** six statuses become seven (Delivered is new), with free moves among the active ones, a zero-balance rule for Completed, locked end states and a reopen rule. This line is already ticked `[x]` (plan 07-03 built it); the tick stays.

**Current line (verbatim):**

> - [x] **ORD-17**: Order status changes follow defined allowed transitions among Pending, Mockup, In Production, Ready, Completed and Cancelled ⚑ OD-3, C-39

**Proposed line:**

> - [x] **ORD-17**: Order status changes follow defined allowed transitions among seven statuses: Pending, Mockup, In Production, Ready, Delivered, Completed and Cancelled. Delivered means the order was handed to the customer, and a balance may still be owed. Staff can move an order forward or back freely among the five active statuses and can cancel from any of them. Completed needs a balance of exactly ₱0.00, so an order with money owed or with a customer credit cannot be Completed. Completed and Cancelled are locked end states that Admins and Managers can reopen; a reopen is recorded in the status history and audited like any other change. There is no direct move between Completed and Cancelled: reopen first, then cancel ⚑ OD-3, C-39 (owner, <date you approve>, D-01 to D-05, D-38)

**Decisions carried:** D-01 (seven statuses), D-02 (free moves, cancel from any active status), D-03 (Completed needs ₱0.00), D-04 (end states, both roles reopen), D-05 (locked until reopened, refund exception under ORD-18), D-38 (no Completed to Cancelled move).

## 5. ORD-18 (D-07 to D-10, D-34 to D-36)

**What changes:** the vague "decided policy" becomes the actual policy: a refund record, who may record it, its caps, and how a cancelled order's profit is worked out.

**Current line (verbatim):**

> - [ ] **ORD-18**: Payments on cancelled orders and refunds follow a decided policy, so collected-cash figures stay correct ⚑ C-37

**Proposed line:**

> - [ ] **ORD-18**: Payments on a cancelled order stay collected cash unless a refund is recorded. A refund is its own record on the order: date, an amount more than ₱0.00 and at most ₱1,000,000.00, a short required reason, and who handed the money back (an active Admin or Manager, validated like Received by). Any staff member can record a refund, on a Cancelled order or on an order that shows a customer credit, and every refund is audited. The cap is the amount paid minus earlier refunds on a Cancelled order, and at most the customer credit on any other order, so a refund never puts the customer back in debt. Refunds on a Cancelled order can be recorded, edited or removed without reopening it. A cancelled order's expenses still count in the payer's money on hand, in expense totals and in the order's profit. Profit on a Cancelled order is money kept minus money spent, (paid − refunded) − expenses, so the order can show a loss; every other status keeps total − expenses ⚑ C-37 (owner, <date you approve>, D-07, D-09, D-10, D-34, D-35, D-36)

**Decisions carried:** D-07 (payments stay unless refunded; the refund record), D-09 (any staff member records; cap rule), D-10 (cancelled-order expenses still count), D-34 (cap on a non-cancelled order is the credit), D-35 (edit or remove refunds on a Cancelled order without reopening), D-36 (cancelled-order profit). D-30 (limits: more than ₱0.00 and at most ₱1,000,000.00) is used for the amount range.

## 6. MONEY-01 (D-08)

**What changes:** a refund lowers the money on hand of the person who handed it back. This replaces the earlier default that refunds do not count (OD-16).

**Current line (verbatim):**

> - [ ] **MONEY-01**: Each staff user (Admin or Manager) has a **money on hand** balance that the server computes from the ledger: Σ payments they received (ORD-22) + Σ transfers to them − Σ transfers from them − Σ company and order expenses they paid (CEXP-05, ORD-23; owner ruling, 2026-10-07). Deleted transfers and deleted expenses never count. It is `decimal(18,2)` PHP, never stored as an editable number, and no endpoint accepts a balance value (Core Value: money is computed server-side). The expense payers ship before this phase (CEXP-05 in Phase 6, ORD-23 in Phase 7), so Phase 10 depends on both and no phase moves. An integration test gives one staff member payments received, transfers in and out, and company and order expenses paid, and asserts the exact balance; changing an expense's Paid by moves its amount from one balance to the other exactly ⚑ OD-15, OD-16

**Proposed line (only the formula and the test sentence change):**

> - [ ] **MONEY-01**: Each staff user (Admin or Manager) has a **money on hand** balance that the server computes from the ledger: Σ payments they received (ORD-22) + Σ transfers to them − Σ transfers from them − Σ company and order expenses they paid (CEXP-05, ORD-23) − Σ refunds they handed back (ORD-18) (owner rulings, 2026-10-07 and, for refunds, D-08 of 2026-10-27). Deleted transfers and deleted expenses never count. It is `decimal(18,2)` PHP, never stored as an editable number, and no endpoint accepts a balance value (Core Value: money is computed server-side). The expense payers ship before this phase (CEXP-05 in Phase 6, ORD-23 in Phase 7), and so do refunds (ORD-18 in Phase 7), so Phase 10 depends on all three and no phase moves. An integration test gives one staff member payments received, transfers in and out, company and order expenses paid, and refunds handed back, and asserts the exact balance; changing an expense's Paid by moves its amount from one balance to the other exactly ⚑ OD-15, OD-16 (owner, <date you approve>, D-08)

**Decision carried:** D-08. Everything else in the line is as it is today. Whether refunds on a soft-deleted order still count is not covered by any ruling, so this draft says nothing about it.

## 7. ROADMAP.md: Phase 7 notes line (success criteria text stays unchanged)

**What changes:** one italic notes line is added under the Phase 7 success criteria, in the same style as the Phase 6 notes. The criteria themselves are not edited. There is no notes line for Phase 7 today.

**Current text:** none.

**Proposed line (added after criterion 7, before "Owner decisions to close at discuss step"):**

> *Notes (owner decisions, Phase 7 discuss 2026-10-27 and 2026-10-28; the criteria text above is unchanged):* criterion 1's "one of the 6 product types" is superseded by D-18 (a Manager-editable product type list that starts with the six), criterion 2's "overpayment rule across all mutation types" by D-12 (only a payment above the balance is refused; other changes may leave a customer credit that a refund clears), and criterion 4's refund and cancelled-order policy is D-07 to D-10 and D-34 to D-36 (payments stay collected cash unless refunded, refund caps, and cancelled-order profit). See `phases/07-order-domain-api/07-CONTEXT.md`.

**One addition for you to check:** your task list named criterion 1 and criterion 4. I also named criterion 2, because its "overpayment rule across all mutation types" is the same wording that D-12 replaces in ORD-05. If you would rather leave criterion 2 out, say so under "approve with edits" and I will drop that clause.

## 8. ROADMAP.md: new Phase 7.1 entry (D-33)

**What changes:** a new decimal phase is added after Phase 7. It is created with the standard `gsd-tools phase insert` command, then its goal and dependency are filled in with the text below. No whole-file rewrite.

**Name:** Legacy Fit Check (read-only)

**Goal (proposed):**

> Before Phase 8 builds on the order rules, a read-only check runs the legacy orders in CSPS_Legacy_Restore through Order.Import's rules and lists every record that breaks them. It never derives the schema, never writes to the restore and never restores over CSPS_Dev (D-33).

**Depends on (proposed):** Phase 7

**Requirements:** none new. It is a read-only check, and no requirement text depends on it.

**Safety limits written into the goal (D-33):** reads `CSPS_Legacy_Restore` only; never derives the schema; never writes to the restore; never restores over `CSPS_Dev`. The restore stays in `(localdb)\MSSQLLocalDB` as the project rules already say.

**Note on the insert command:** the command may also add a placeholder success-criteria or plans line. Anything it adds beyond the goal and dependency stays as a "to be planned" placeholder. Real criteria and plans come when Phase 7.1 is planned.

## 9. Your three options

| Option | What happens |
|--------|--------------|
| **approve-all** (recommended: it repeats your own rulings) | All six requirement lines and the Phase 7 notes line go in as drafted above, each with a dated owner note. Phase 7.1 is added to the roadmap. This file is marked approved. |
| **approve-with-edits** | You change the wording in this file (or tell me the edits). I apply your exact words, then the same steps as above. |
| **hold** | Nothing changes. The requirement lines keep contradicting D-01, D-12 and D-18 until you decide, and Phase 7.1 is not scheduled. |

**In plain words, what changes if you approve:**

- ORD-05: only a payment above the balance is refused. Other edits can leave a customer credit, and a refund clears it.
- ORD-06: delete is a soft delete for both roles. Managers see deleted orders, restore them and delete them for good.
- ORD-13: product types are a list Managers can edit. It starts with the six.
- ORD-17: seven statuses, with Delivered added. Completed needs a zero balance. Completed and Cancelled are locked until reopened. No direct Completed to Cancelled move.
- ORD-18: payments on a cancelled order stay collected cash unless refunded. Refunds have a record, caps and a reason. A cancelled order can show a loss.
- MONEY-01: a refund lowers the money on hand of whoever handed it back.
- Roadmap: one notes line under the Phase 7 criteria, and a new Phase 7.1 "Legacy Fit Check (read-only)" after Phase 7.

Nothing else in `REQUIREMENTS.md` or `ROADMAP.md` is touched. The ticked or unticked state of every line stays as it is.

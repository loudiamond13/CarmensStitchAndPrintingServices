---
created: 2026-10-25T06:55:00-05:00
updated: 2026-10-25T23:58:00-05:00
---

# The company expenses API

This is the contract behind the Company Expenses screens, and the one a future Android app will use. Everything here is under
`/api/v1`. The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of
this page; the web app's types are generated from it (`web/src/types/api.generated.ts`). Sign-in and the access token are in
[auth.md](auth.md). Later plans add the other expense routes to this page.

## In plain words

1. **Categories:** every company expense has a category. The categories are rows in the database, ten of them from the start
   (Rent, Utilities, Salaries, Supplies, Equipment, Maintenance, Government contributions, Taxes and permits, Transport and fuel,
   Others). Each carries one of six colour tones.
2. **Paid by:** an expense names the person who paid. Both roles can read the short list of people who can be chosen.
3. The server decides everything. The web app only shows the answer.

## Where the routes live

| Area | Base path | Policy |
|---|---|---|
| Expense categories | `/api/v1/expense-categories` | Staff to read the list; Manager for everything else |
| Staff who can pay | `/api/v1/staff` | Staff |
| Company expenses | `/api/v1/company-expenses` | Staff |

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. The four deletion routes
(delete, restore, permanent delete and the deleted list) are **Manager** only: an `Admin` gets `403`. No token is `401`. No
answer is ever cached (`Cache-Control: no-store`).

## Expense categories (D-08 to D-15, D-27, D-30, OQ-4, OQ-6, OQ-10)

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /expense-categories` | Staff | none | `200` an array of `{ id, name, tone, status, isOthers, expenseCount }`. |
| `POST /expense-categories` | Manager | `{ name, tone }` and an `Idempotency-Key` | `201` the new category in the list shape, with a `Location` header; `400` field errors. |
| `GET /expense-categories/{id}` | Manager | none | `200` the detail (below); `404`. |
| `PUT /expense-categories/{id}` | Manager | `{ name, tone, version }` | `200` the detail; `400`; `404`; `409 edit.stale`. |
| `POST /expense-categories/{id}/retire` | Manager | none, with an `Idempotency-Key` | `204`; `404`; `422 expense-categories.protected`. |
| `POST /expense-categories/{id}/reactivate` | Manager | none, with an `Idempotency-Key` | `204`; `404`. |
| `DELETE /expense-categories/{id}` | Manager | none | `204`; `404`; `422 expense-categories.in-use` or `expense-categories.protected`. |

Every write is **Manager** only: an `Admin` gets `403`, no token is `401`. Reading the list stays open to both roles.

- `tone` is one of `neutral`, `accent`, `info`, `mockup`, `warning`, `success`. The database accepts no other value. There is no
  free colour.
- `status` is `active` or `retired`. Retired categories are still listed, so the list filter can find old expenses; the Add
  picker hides them.
- The order is A to Z by name, then by id, with **Others always last**, after every add and rename.
- `isOthers` is true only for Others, the catch-all that can never be renamed, retired or deleted.
- `expenseCount` is how many expenses use the category, soft-deleted ones included (D-10). A count of 0 means the category can be
  deleted.

### The detail

`GET` and `PUT` answer `{ id, name, tone, status, isOthers, expenseCount, recordedBy, recordedAt, lastChangedBy, lastChangedAt,
version }`. `recordedBy` is `null` for the ten starting categories, which read **System**. `lastChangedBy` and `lastChangedAt` are
`null` until a change. `version` is the base64 of the eight-byte row version a save must send back.

### The fields and their rules (OQ-10)

| Field | Rule | Message |
|---|---|---|
| `name` | Required after trimming | `Enter a category name.` |
| `name` | At most 40 characters after trimming | `Keep the name to 40 characters or fewer.` |
| `name` | Unique among **all** categories, retired ones included, ignoring letter case | `Another category already has this name.` |
| `name` | Others keeps its name | `The Others name can't change.` |
| `tone` | One of the six | `Choose a badge color.` |
| `version` | Base64 of exactly eight bytes (`PUT` only) | `Reload the form and try again.` |

The name check is a look-up first and the unique index second, so two Managers saving one name at the same moment get one success
and one `400` on `name`, never a `500`. Other members in the body, such as `createdById` or `updatedAt`, are ignored: who changed a
category and when come from the token and the clock.

### Renaming and recoloring (D-12, D-13, SEC-07)

- A rename shows the new name on every expense, past ones included, because expenses point at the category by id.
- A save with the stored `version` wins; a stale one is `409 edit.stale` and changes nothing. A form save is never retried. Two
  saves sent together with one version give one `200` and one `409`.
- A save that changes nothing is a `200` with the same `version`; it writes no audit entry.
- Others can change colour but not name (`400` on `name`).

### Retiring and bringing back (D-11, OQ-4, OQ-6)

- Retiring keeps the category in the list as `retired`. Old expenses keep it, and editing one without changing its category still
  works. A new expense in a retired category is refused, and so is changing an expense to it.
- Retiring a retired category, or bringing back an active one, is a `204` that changes and records nothing.
- Retire and bring back take no version. They act on the latest state and run again once when two saves collide. Others can never
  be retired: `422 expense-categories.protected`, "The Others category can't be retired or deleted."

### Deleting (D-10, D-30)

- A category can be deleted only while **no expense row uses it, soft-deleted ones included**. Otherwise `422
  expense-categories.in-use`, "This category is used by an expense, so it can't be deleted. Retire it instead."
- Once every expense in the category has been deleted for good (`DELETE /company-expenses/{id}/permanent`), the category can be
  deleted again. There is no "was used" marker.
- The foreign key from the expenses to the category is the backstop when an expense is saved in the same moment. Either the delete
  is refused with the same `422`, or the expense is refused with `400` on `categoryId`, "Choose a category." If the two collide in
  the database and the delete loses, it reads again and ends with the `422`. No row is ever left pointing at a deleted category,
  and no database trigger is involved.
- Deleting Others is `422 expense-categories.protected`. Deleting a category that is gone is `404 expense-categories.not-found`,
  "This category was deleted."

### The audit entries (D-27)

Every change writes its entries in the same save, with the Manager as the actor, target type `ExpenseCategory` and the category id
as the target. Names are percent-encoded for `%`, `;`, `=` and `>`.

| Action | Detail |
|---|---|
| `expense-category.added` | `name=<name>;tone=<tone>` |
| `expense-category.renamed` | `name=<old>><new>` |
| `expense-category.recolored` | `tone=<old>><new>` |
| `expense-category.retired` | `name=<name>` |
| `expense-category.reactivated` | `name=<name>` |
| `expense-category.deleted` | `name=<name>` |

A save that changes both name and tone writes both the renamed and the recolored entry. A no-op writes none.

## Staff who can pay (CEXP-05, D-32, D-49)

| Method and path | Body | Answers |
|---|---|---|
| `GET /staff` | none | `200` an array of `{ id, name }`. |

A person is listed when they are an `Admin` or `Manager`, active, not locked by a Manager, not deleted, and have signed in at
least once (they entered a sign-in code or accepted an invite). An invited person who has not set a password yet is never
listed. A person a Manager adds with a temporary password appears after their first correct sign-in code. Staff whose password
a Manager reset stay listed, because the first sign-in mark is never cleared. A later legacy import must mark the staff it brings
over, or they cannot be chosen as Paid by.

- **Names only:** the answer holds an id and a name (`First Last`, exactly as saved). It never holds an email address, a role or
  an account state. The full roster stays Manager-only (`GET /users`).
- The order is first name, then last name, then id, so two people with the same name always come back in the same order.
- The list is never empty for a signed-in caller, because the caller has signed in and is always in it.

## Recording and reading one expense (CEXP-02, CEXP-04, CEXP-05)

| Method and path | Body | Answers |
|---|---|---|
| `POST /company-expenses` | `{ date, categoryId, description, amount, paidByUserId, notes }` | `201` the expense and a `Location` of `/api/v1/company-expenses/{id}`, `400` with field errors, `401`. |
| `GET /company-expenses/{id}` | none | `200` the expense, `401`, `404` `company-expenses.not-found` ("This expense was deleted."). |

Both roles may call both routes, and both see every expense (D-25). The POST needs an `Idempotency-Key` header. A retry with the
same key and the same body answers with the stored `201` (and `Idempotent-Replayed: true`) and records nothing more; the same key
with a different body is a `422`.

### The fields and their rules

Every rule is checked on the server, whatever the browser already checked. A `400` lists **every** field that failed at once, with
the code `company-expenses.invalid-request` and the title "Check the highlighted fields."

| Field | Rule | Message |
|---|---|---|
| `date` | Required | Enter the date. |
| | A real `yyyy-MM-dd` day | Enter a real date. |
| | Any past day; at most 30 days after today in the business zone (Asia/Manila) | Choose a date up to 30 days from today, {MMM d, yyyy} at the latest. |
| `categoryId` | Required, and an existing category | Choose a category. |
| | Not retired | This category was retired. Choose another one. |
| `description` | Required after trimming | Add a short description so others know what this was for. |
| | At most 200 characters after trimming | Keep the description to 200 characters or fewer. |
| `amount` | More than 0.00 | Enter an amount greater than ₱0.00. |
| | At most 1,000,000.00 | Enter an amount of ₱1,000,000.00 or less. |
| | At most 2 decimal places (`1250.1` and `1250.10` pass, `1250.123` does not) | Use at most 2 decimal places. |
| `paidByUserId` | Required | Choose who paid. |
| | An active Admin or Manager who has signed in at least once, not locked and not deleted (D-17, D-32, D-49); never "the company" | This person can't be chosen because their account isn't active. Choose someone else. |
| `notes` | Optional; trimmed; empty means none; at most 1,000 characters (D-19) | Keep notes to 1,000 characters or fewer. |

- Lengths are counted in UTF-16 code units after trimming, the same measure a browser string length uses.
- The database checks only that the amount is more than 0 (D-33). The 1,000,000.00 cap lives in the validators and the domain, so
  it can change without a migration.
- On an edit, the amount cap and the description and notes lengths apply only to a value that changes. An imported expense over a
  limit stays editable, for example to fix its category, while a changed value must meet the limit.
- There is no vendor field (D-19).

### The answer

`{ id, date, category { id, name, tone, retired }, description, amount, notes, paidBy { id, name, formerStaff }, paidByActive,
recordedBy { id, name, formerStaff } | null, recordedAt, lastChangedBy | null, lastChangedAt | null, version, canEdit }`

- **Who and when come from the server (SEC-08).** `recordedBy` is the person in the token and `recordedAt` is the server clock.
  Any `createdById`, `createdAt`, `updatedById`, `updatedAt`, `deletedAtUtc` or `rowVersion` in the POST body is ignored.
  `lastChangedBy` and `lastChangedAt` stay `null` until the expense is edited. `recordedBy` is `null` (read as System) for a row
  with no creator.
- **Recorded by is not Paid by.** An expense recorded by A and paid by B reads `paidBy` B and `recordedBy` A. The recorder may also
  be the payer; both fields then name that person.
- `paidByActive` is false when the saved payer can no longer be chosen (deactivated, locked or deleted since, or has not signed
  in yet). The payer still
  shows, with "(former staff)" when `formerStaff` is true.
- `version` is the base64 of the 8-byte row version. A later edit sends it back; text that is not base64 of exactly 8 bytes is
  not a version.
- `canEdit` is true for a Manager, and for an Admin who recorded the expense or is named as the payer (D-26). The list and the
  save use the same rule, so they never disagree.
- An expense that was soft-deleted answers `404` like one that never existed (D-01).

### The audit entry (D-27)

Every create writes one `company-expense.added` entry in the same transaction, with target type `CompanyExpense`, the expense id
as the target, and the detail `date=2026-10-25;category=<category id>;amount=640.00;payer=<payer id>`. The description and the
notes never reach the audit log, because they can hold personal details (D-06).

### Money on hand (D-22, for Phase 10)

An expense counts against its payer's money on hand **from the moment it is saved, not from its date**. A future-dated expense
therefore lowers the payer's balance at once. Soft-deleted expenses never count (MONEY-01), and a restored one counts again.

## Editing an expense (CEXP-02, CEXP-04, CEXP-05, SEC-07, D-11, D-26)

| Method and path | Body | Answers |
|---|---|---|
| `PUT /company-expenses/{id}` | `{ date, categoryId, description, amount, paidByUserId, notes, version }` | `200` the saved expense, `400` with field errors, `401`, `403` `company-expenses.not-yours`, `404` `company-expenses.not-found`, `409` `edit.stale`. |

The body is the Add form plus the `version` the form was opened with (the `version` of the `GET` answer). There is no
`Idempotency-Key`: a form edit is never retried by the server.

- **Same field rules, same words.** The date, category, description, amount, payer and notes rules and messages are the table
  above, held in one validator shared with the POST. `version` must be base64 of exactly 8 bytes, else `400` on `version` with
  "Reload the form and try again."
- **Step order.** The form is checked first (`400`), then the expense is found (`404`), then the caller's right to edit it (`403`),
  then the version (`409`), then the category and payer that the form changes (`400`). The first failure answers and nothing is saved.
- **Who may edit (D-26).** A Manager may edit any expense. An Admin may edit only one they recorded or are named as payer of;
  otherwise `403` with the code `company-expenses.not-yours` and "Admins can edit only the expenses they recorded or paid. Ask a
  Manager to change it." The list's `canEdit` uses the same rule. An Admin who moves the payer away from themselves on an expense
  someone else recorded gets `200`, and from then on `canEdit` is false for them and a further `PUT` is `403`.
- **Stale versions (SEC-07).** A `version` that is not the stored one answers `409` with the code `edit.stale` and "This was changed
  by someone else. Reload and try again." Nothing is stored. When two people send the same version together, exactly one gets
  `200` and the other `409`; the stored values and the list's `periodTotal` are the winner's.
- **A saved payer or category may stay.** Only a payer or category the form changes is checked. A changed payer must pass the same
  rule as the POST (active Admin or Manager who has signed in at least once, not locked, not deleted), else `400` on `paidByUserId`. A changed
  category must exist and not be retired, else `400` on `categoryId`. An expense keeps its retired category, and its payer after
  that person is deactivated, while the form leaves them as they are (D-11, OQ-7).
- **Nothing changed.** A form whose values equal the stored ones answers `200` with the same `version` and writes nothing.
- **Who changed it comes from the server (SEC-08).** `recordedBy` stays the creator. `lastChangedBy` and `lastChangedAt` are the
  editor and the server time. A `createdById`, `createdAt`, `updatedById` or `updatedAt` in the body is ignored. Names are read
  from the people's own rows, so a deleted person keeps their name with `formerStaff` true.
- A soft-deleted or unknown id answers `404` "This expense was deleted."

### The audit entries of an edit (D-27)

An edit that changes something writes up to two entries in the same transaction as the save, with target type `CompanyExpense` and
the expense id as the target. A save with no change writes none.

| Entry | Written when | Detail |
|---|---|---|
| `company-expense.changed` | the amount, date, category, description or notes changed | `amount=1200.00>1250.00;date=2026-10-01>2026-10-02;category=<old id>><new id>;fields=description,notes;payer=<id>` |
| `company-expense.payer-changed` | the payer changed | `payer=<old id>><new id>` |

- Only the parts that changed appear. `amount`, `date` and `category` carry the old and the new value (amounts as `0.00`, dates as
  `yyyy-MM-dd`, ids dashed). The description and the notes are named in `fields=` and their text is never written (D-06). The
  entry ends with the payer the expense has after the edit.
- The payer change is its own entry and is never merged into the other one. An edit that changes the payer and the date writes
  both. A payer-only edit writes only `company-expense.payer-changed`.

## Deleting, restoring and the deleted list (CEXP-02, D-01 to D-07, D-27, D-31)

| Method and path | Body | Answers |
|---|---|---|
| `DELETE /company-expenses/{id}` | none | `204`, `401`, `403` for an Admin, `404` `company-expenses.not-found`. |
| `POST /company-expenses/{id}/restore` | none; needs an `Idempotency-Key` | `204`, `400` without a key, `401`, `403`, `404`. |
| `DELETE /company-expenses/{id}/permanent` | none | `204`, `401`, `403`, `404`. |
| `GET /company-expenses/deleted` | query `q`, `category`, `page`, `pageSize` | `200` the page, `400`, `401`, `403`. |

**Who may call:** Managers only. The Staff rule of the other routes does not apply here, and an Admin gets `403` even on an expense they
recorded or paid. There is no row version on these single-click actions: each one acts on the latest state, inside a transaction, and
a lost race is read again and decided again (a second pass that finds nothing answers `404`, never a double effect).

- **Soft delete (D-01).** The row stays, with who deleted it and when. The expense leaves the list, its total, the month KPIs and the
  detail (`404`), and an edit of it (`PUT`) is `404`. Last changed by and at become the Manager and the server time (D-31). A second
  delete answers `404` and writes nothing. Two deletes sent together give one `204`, one `404` and one audit entry.
- **Restore (D-03).** It clears the delete marker, so the expense counts again everywhere. Last changed by and at become the Manager who
  restored it. Restoring an expense that is not deleted is a `204` that writes and audits nothing; an unknown id is `404`. The same
  restore sent again with the same `Idempotency-Key` answers with the stored `204` (`Idempotent-Replayed: true`) and does not run twice.
- **Permanent delete (D-04).** It removes the row from the database, whether or not it was soft-deleted first, and there is no way
  back. A second call is `404`. Because the row is gone, an expense that used a category no longer counts as using it, so that
  category can be deleted again under D-30 once no other expense or soft-deleted expense uses it.
- **The deleted list (D-07).** It lists only soft-deleted expenses, most recently deleted first and then by id. Page 1 to 100000, page
  size 1 to 100 (20 when not sent), `q` and `category` as in the main list (`q` looks at the description and the payer's or recorder's
  name, never the notes). The answer is `{ items, total, page, pageSize }` with each item `{ id, deletedAt, deletedBy | null, date,
  category { id, name, tone, retired }, description, amount, paidBy { id, name, formerStaff } }`. There is no period total and no notes.
  `deletedBy` is `null` when no person is recorded (it reads as System).

### The audit entries of a deletion (D-06, D-27)

Each action writes one entry in the same transaction, with target type `CompanyExpense` and the expense id as the target.

| Entry | Written when | Detail |
|---|---|---|
| `company-expense.deleted` | an expense is soft-deleted | `date=2026-10-05;category=<id>;amount=1200.00;payer=<id>` |
| `company-expense.restored` | a deleted expense is restored | the same snapshot |
| `company-expense.permanently-deleted` | an expense is removed for good | the same snapshot |

- The snapshot holds the date, the category id, the amount and the payer id. **The description and the notes are never written**,
  because they can hold personal details (D-06).
- The permanent-delete entry is written before the row is removed, in the same transaction, so the entry stays when the row is gone.
- A restore of an expense that is not deleted, and a delete of one that is gone, write nothing.

## Listing expenses (CEXP-01, CEXP-05, D-23, D-25, D-26)

| Method and path | Body | Answers |
|---|---|---|
| `GET /company-expenses` | none; query `q`, `category`, `from`, `to`, `page`, `pageSize` | `200` a page, `400` for a bad filter, `401` without a token. |

Both roles get every expense (D-25). Nothing is cached.

### The query

| Part | Rule | Message when broken |
|---|---|---|
| `q` | Optional; at most 100 characters; blank means no search | Use 100 characters or fewer. |
| `category` | Optional; a dashed category id | Choose a category from the list. |
| `from`, `to` | Optional, but sent as a pair; real `yyyy-MM-dd` days | Enter a real date. / Enter both dates, or neither. (on the one that is missing) |
| | `from` on or before `to` | The start date must be on or before the end date. (on `from`) |
| `page` | 1 to 100000; 1 when not sent | Use a page from 1 to 100000. |
| `pageSize` | 1 to 100; 20 when not sent | Use a page size from 1 to 100. |

- **The window is the server's (D-23).** With neither `from` nor `to`, the window runs from 30 days before to 30 days after
  today in the business zone (Asia/Manila by default), both days included. The answer carries the `from`, `to` and `today` it used,
  so the browser never reads the device clock for any of them.
- **Search** matches the description, the payer's name and the recorder's name (first name, last name, or "first last"),
  ignoring case. `%`, `_`, `[` and `\` are taken literally. Notes are never searched or returned (D-19).
- Soft-deleted expenses are never listed or counted (D-01).

### The answer

`{ items, total, page, pageSize, periodTotal, from, to, today }`

- Each item is `{ id, date, category { id, name, tone, retired }, description, amount, paidBy { id, name, formerStaff },
  recordedBy { id, name, formerStaff } | null, canEdit }`. `recordedBy` is `null` for System.
- **Order:** newest expense date first, then newest recorded time, then id, so paging is stable and no row shows on two pages.
- **Totals cover every page.** `total` is the count of all matching expenses and `periodTotal` is the sum of their amounts, both
  worked out in the database, never from the rows on the page. `periodTotal` is `0.00` when nothing matches. A page past the last
  returns no items with the true `total` and `periodTotal`.
- `canEdit` follows the same rule as the detail and the save (D-26): true for a Manager on every row, true for an Admin only on
  rows they recorded or pay.
- The server reads the list in exactly two SQL commands whatever the page size (PERF-04).

## Month KPIs (CEXP-03, D-24, D-25)

| Method and path | Body | Answers |
|---|---|---|
| `GET /company-expenses/kpis` | none; no query parameters | `200` the figures, `401` without a token. |

Both roles get the same figures. Nothing is cached. The list filters (`q`, `category`, `from`, `to`) do not apply: the cards always
show whole months.

### The answer

`{ today, thisMonth { month, total, count }, lastMonth { month, total, count }, topCategory { category { id, name, tone, retired }, total, sharePercent } | null }`

- `month` is the first day of the month as `yyyy-MM-01`. `today` is the business today.
- **Months follow the business zone (Asia/Manila by default), never the server's or the device's clock.** "This month" is the
  month that holds the business today. At 07:00 in Manila on 1 November (23:00 UTC on 31 October) this month is already
  November; at 23:59:59 in Manila on 31 October it is still October. Last month is the full month before it.
- **Expenses count by their expense date (D-24).** An upcoming expense dated later this month counts in this month. One dated
  next month counts nowhere. A deleted expense never counts (D-01).
- `total` is the sum of the month's amounts, worked out in the database; it is `0.00` with `count` `0` for an empty month.
- **Top category:** the category with the highest total this month. If two categories tie, the one whose name comes first A to Z
  wins. `sharePercent` is its total divided by this month's total times 100, rounded to a whole percent with
  half away from zero (12.5 becomes 13). With no expense this month `topCategory` is `null`.
- The server reads the figures in two SQL commands: both months together, then this month by category.

## The slice pattern Orders copies (D-29)

Company expenses are the simplest aggregate, built first to prove the pattern the order aggregate copies in Phase 7. This is the
checklist. Each line names the file that does it and the test that pins it, so Phase 7 copies the shape and keeps the proof.

1. **A form save carries a row version (SEC-07).** The edit form sends the `version` of the answer it was opened with. A stale
   version is `409 edit.stale` and stores nothing; a form save is never retried by the server. The web keeps the typed values, shows
   the shared `ConflictBanner` with **Load Latest**, and puts focus on that button. Files: `UpdateCompanyExpenseHandler.cs` (the
   version compare comes after the right-to-edit check), `ExpenseModal.tsx`, `ConflictBanner.tsx`. Proof: the `@expenses-edit`
   e2e (two tabs, second save is stale, Load Latest, save again) and the 409 handler tests.
2. **Single-click actions send no version.** Delete, restore and permanent delete act on the latest state. The handler runs inside
   `ConflictRetry.RunAsync` and `unitOfWork.InTransactionAsync`, so a lost race is read again and decided again: a second pass that
   finds nothing answers `404`, never a double effect. Files: `DeleteCompanyExpenseHandler.cs`, `RestoreCompanyExpenseHandler.cs`,
   `PermanentlyDeleteCompanyExpenseHandler.cs`, `ConflictRetry.cs`. Only restore, a POST, needs an `Idempotency-Key`; the two
   deletes are DELETE calls.
3. **A list is read in two commands, with the totals worked out by the database.** `CompanyExpenseReader` runs one command for the
   page and one for the count and sum, whatever the page size. `total` and `periodTotal` cover every page, never the rows on the
   screen. Files: `CompanyExpenseReader.cs`, `ListCompanyExpensesHandler.cs`. Proof: `CompanyExpenseReaderQueryCountTests`
   (the reader runs exactly two commands) and `CompanyExpenseListQueryCountTests` (the endpoint does too).
4. **The `CommandCounter` guard and the timing test.** The query-count tests count the real SQL commands a request sends, so an
   accidental per-row query (N+1) fails a test. `ExpenseListTimingTests` seeds five years of fake data (about 36,500 rows) and
   holds the p95 of the default window, a category filter, a staff-name search, a five-year last page and the KPIs to 300 ms.
   Orders copy both: a count test for each reader, and a timing test with their own data size. How to run and read them:
   [list-performance.md](../operations/list-performance.md).
5. **Soft delete is a named query filter.** `CompanyExpenseConfiguration` declares `HasQueryFilter("SoftDelete", ...)`, so every
   read hides deleted rows with no code in the handler. Only the deleted list and the stores that must see a deleted row call
   `IgnoreQueryFilters(["SoftDelete"])` by that name. A deleted row answers `404` like a row that never existed. Files:
   `CompanyExpenseConfiguration.cs`, `CompanyExpenseReader.cs`, `CompanyExpenseStore.cs`.
6. **The audit detail has one format.** `AuditDetailFormat` writes `key=value` and `key=old>new` pairs joined by `;`: amounts as
   `0.00`, dates as `yyyy-MM-dd`, ids as dashed lower-case GUIDs, free text percent-encoded. Free text a person typed (a
   description, notes) never reaches the log; only the field name does (`fields=description,notes`). The audit entry is written in
   the same save as the change, and a permanent delete writes it first so the entry outlives the row. The viewer turns the stored
   detail into change lines on the server and names people and categories there. Files: `AuditDetailFormat.cs`,
   `ExpenseAuditDetail.cs`, `AuditLogReader`, [audit-log.md](../operations/audit-log.md).
7. **The staff lookup and `PaidBySelect`.** `GET /api/v1/staff` answers only `{ id, name }` of the people who can be chosen, for
   both roles; the full roster stays Manager-only. The web reads it through `useStaffLookupQuery` and `PaidBySelect`, which puts
   the signed-in person first as "(you)" and keeps a saved payer who can no longer be chosen, marked "(inactive)" or
   "(former staff)". Orders reuse both for Received by and the payment payer. Files: `StaffController.cs`, `StaffDirectory.cs`,
   `useStaffLookupQuery.ts`, `PaidBySelect.tsx`.
8. **A delete is the shared `ConfirmDialog`.** A plain confirmation names the thing and its amount, focus starts on Cancel, nothing
   is sent until the confirm, and the toast says where to restore it. A permanent delete is the same dialog with the can't-be-undone
   warning. Files: `ConfirmDialog.tsx`, `ExpensesPage.tsx`, `PurgeExpenseDialog.tsx`.
9. **One URL-state hook per list.** Each list has a `use<Thing>ListParams` hook built with `createListParams`: page, size, search and
   its own filters live in the address (WEB-10), defaults stay out of it, a bad value falls back and is removed with one replace,
   and a filter change resets the page. Files: `useExpensesListParams.ts`, `useDeletedExpensesListParams.ts`,
   `useAuditListParams.ts`, `createListParams.ts`.
10. **Every mutation refreshes what it changed.** After an add, edit, delete, restore or permanent delete the web invalidates the
    list (`expensesKey`), the month figures (`expenseKpisKey`) and the deleted list together, so no screen shows an old total
    (`useRefreshExpenses.ts`).

## Testing builds only

`POST /api/testing/expenses` exists only in the Testing environment of a Debug build. A Release build has no such route. It needs
no token and no `Idempotency-Key`, and it lets the web e2e specs fill the list with chosen data.

Body: `{ paidByUserId, recordedByUserId?, date, categoryId, description, amount, notes?, deleted? }`. It answers `201 { id }` or a
`400` listing the fields that failed. The stored recorder is `recordedByUserId` (none reads as System), and `deleted: true` stores the
expense already soft-deleted with that person as the one who deleted it. The helper is `createExpense` in `web/e2e/testing-api.ts`.

---
created: 2026-10-25T06:55:00-05:00
updated: 2026-10-25T07:54:31-05:00
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
| Expense categories | `/api/v1/expense-categories` | Staff |
| Staff who can pay | `/api/v1/staff` | Staff |
| Company expenses | `/api/v1/company-expenses` | Staff |

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. No token is `401`. No
answer is ever cached (`Cache-Control: no-store`).

## Expense categories (D-08, D-09, D-11, D-13, D-15)

| Method and path | Body | Answers |
|---|---|---|
| `GET /expense-categories` | none | `200` an array of `{ id, name, tone, status, isOthers }`. |

- `tone` is one of `neutral`, `accent`, `info`, `mockup`, `warning`, `success`. The database accepts no other value.
- `status` is `active` or `retired`. Retired categories are still listed, so the list filter can find old expenses; the Add
  picker hides them.
- The order is A to Z by name, then by id, with **Others always last**.
- `isOthers` is true only for Others, the catch-all that can never be retired.

## Staff who can pay (CEXP-05, D-32)

| Method and path | Body | Answers |
|---|---|---|
| `GET /staff` | none | `200` an array of `{ id, name }`. |

A person is listed when they are an `Admin` or `Manager`, active, not locked by a Manager, not deleted and have a password. An
invited person who has not set a password yet is never listed. A person a Manager created with a temporary password has a
password, so they are listed before their first sign-in (the owner may change this, see the Owner backlog in the planning state).

- **Names only:** the answer holds an id and a name (`First Last`, exactly as saved). It never holds an email address, a role or
  an account state. The full roster stays Manager-only (`GET /users`).
- The order is first name, then last name, then id, so two people with the same name always come back in the same order.
- The list is never empty for a signed-in caller, because the caller is active staff with a password and is always in it.

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
| | An active Admin or Manager with a password, not locked and not deleted (D-17, D-32); never "the company" | This person can't be chosen because their account isn't active. Choose someone else. |
| `notes` | Optional; trimmed; empty means none; at most 1,000 characters (D-19) | Keep notes to 1,000 characters or fewer. |

- Lengths are counted in UTF-16 code units after trimming, the same measure a browser string length uses.
- The database checks only that the amount is more than 0 (D-33). The 1,000,000.00 cap lives in the validators and the domain, so
  it can change without a migration.
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
- `paidByActive` is false when the saved payer can no longer be chosen (deactivated, locked or deleted since). The payer still
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

## Testing builds only

`POST /api/testing/expenses` exists only in the Testing environment of a Debug build. A Release build has no such route. It needs
no token and no `Idempotency-Key`, and it lets the web e2e specs fill the list with chosen data.

Body: `{ paidByUserId, recordedByUserId?, date, categoryId, description, amount, notes?, deleted? }`. It answers `201 { id }` or a
`400` listing the fields that failed. The stored recorder is `recordedByUserId` (none reads as System), and `deleted: true` stores the
expense already soft-deleted with that person as the one who deleted it. The helper is `createExpense` in `web/e2e/testing-api.ts`.

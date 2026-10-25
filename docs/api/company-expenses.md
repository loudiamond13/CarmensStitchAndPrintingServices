---
created: 2026-10-25T06:55:00-05:00
updated: 2026-10-25T06:55:00-05:00
---

# The company expenses API

This is the contract behind the Company Expenses screens, and the one a future Android app will use. Everything here is under
`/api/v1`. The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of
this page; the web app's types are generated from it (`web/src/types/api.generated.ts`). Sign-in and the access token are in
[auth.md](auth.md). Later plans add the expense routes to this page.

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

**Staff** means a valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. No token is `401`. Neither
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

---
created: 2026-10-18T16:10:00-05:00
updated: 2026-10-19T03:45:00-05:00
---

# The profile, users and audit log API

This is the contract behind My Profile, the Users screen and the Audit Log, and the one a future Android app will use. It
covers the Phase 5 routes. Sign-in, sessions, password reset, invitations and the email-change link routes are in
[auth.md](auth.md). Everything here is under `/api/v1`. The OpenAPI document (Development only, at `/openapi/v1.json`,
viewer at `/scalar`) is the machine-readable twin of this page; the web app's types are generated from it
(`web/src/types/api.generated.ts`).

## In plain words

1. **My Profile** (`/profile`): any staff member reads their own profile, changes their name, changes their password and
   asks to change their sign-in email. The theme is a per-browser choice and has no route.
2. **Users** (`/users`): only a **Manager** runs the roster. They list and search staff, add a person by invitation or with
   a temporary password, edit a name, role or email, and lock, deactivate or delete a person. An Admin gets `403` on every
   one of these calls.
3. **Audit Log** (`/audit-log`): a Manager reads what happened, newest first. It is read-only and has no export.
4. The server decides everything. The web app only shows the answer: totals, statuses, who did what and when are all
   computed here.

## Where the routes live

The paths in the tables below are shortened. The full base paths are:

| Area | Base path | Policy |
|---|---|---|
| My Profile | `/api/v1/profile` | Staff |
| Users | `/api/v1/users` | Manager |
| Audit Log | `/api/v1/audit-log` | Manager |

## Who may call what

| Policy | Meaning |
|---|---|
| Staff | A valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. |
| Manager | A valid access token of a `Manager`. An `Admin` gets `403`; no token gets `401`. |

Everything else is denied by default. The authorization-matrix test discovers every action and checks it for
anonymous, Admin and Manager callers.

## The Idempotency-Key rule

Every `POST` that changes something needs an `Idempotency-Key: <uuid>` header unless it is on the allow-list in
[auth.md](auth.md) ("Idempotency allow-list"). Send a fresh UUID per user action and **reuse it when you retry the same
action**: the same key with the same body returns the stored answer (`Idempotent-Replayed: true`), the same key with another
body is `422` `idempotency.key-mismatch`, a duplicate while the first still runs is `409` `idempotency.in-progress`, and a
missing or malformed key is `400` `idempotency.key-missing`.

**The documented exception:** the gate covers `POST` only. `PUT` and `DELETE` need no key:

- `PUT` is guarded by the **edit version** (below): a repeat with the same version after a success is refused as stale.
- `DELETE` is naturally repeatable: cancelling an email change with nothing waiting is a `204` that records nothing, and
  deleting someone already deleted is a `404` that changes nothing.

## The edit version (SEC-07, D-20)

`GET /profile` and `GET /users/{id}` return a `version` (a GUID that changes on every save). A save sends back the version
it was opened with. Any other value answers **`409` `edit.stale`** with the text "This was changed by someone else. Reload
and try again." and changes nothing. The web app then keeps what was typed, shows a banner and offers Load Latest. Actions
that act on the latest state (lock, unlock, deactivate, activate, delete, resend, reset, temporary password, cancel an email
change) take no version.

## My Profile (PROF-01..PROF-03, Staff)

| Method and path | Body | Answers |
|---|---|---|
| `GET /profile` | none | `200 { id, firstName, lastName, email, role, pendingEmail, memberSince, version }`. `pendingEmail` is the new address of a waiting email change, otherwise `null`. |
| `PUT /profile` | `{ firstName, lastName, version }` | `200` the profile as saved. `400` with field messages (a name is required and at most 100 characters after trimming). `409` `edit.stale`. Saving the values already stored is a `200` that changes and records nothing. |
| `POST /profile/password` | `{ currentPassword, newPassword }` | `204`. The current password is checked first; a wrong one is `400` under `currentPassword` ("Your current password is incorrect."). The new password follows the password rule in [auth.md](auth.md) (including the breached-password check), with its message under `newPassword`. Every other device is signed out; this one stays signed in, and an email says so. Any open reset link stops working. `429` `profile.password-locked` ("Too many wrong passwords. Try again in 15 minutes.", with `Retry-After`) after five wrong current passwords. `409` when two saves lost a race. Needs `Idempotency-Key`. |
| `POST /profile/email-change` and the four routes after it | see [auth.md](auth.md) "Change my email" | The same current-password check and lock as `POST /profile/password`. |

## Users (USER-01..USER-08, Manager)

A person is shown with a `status` (`active`, `inactive` or `locked`, in that order of precedence) and an `inviteState`
(`none` when a password is set; `pending` or `expired` for a person who has not set one yet). A deleted person is gone from
every call below: their detail answers `404` `users.not-found` ("This user was deleted.").

| Method and path | Body | Answers |
|---|---|---|
| `GET /users?q&role&status&page&pageSize` | none | `200 { items, total, page, pageSize }`, each item `{ id, firstName, lastName, email, role, status, inviteState, createdAt }`. Sorted by first name, last name, then id. `q` searches name and email (a `%` or `_` is searched as itself). `role` is `admin` or `manager`; `status` is `active`, `inactive` or `locked`. `pageSize` is 1 to 100 (20 when not sent). A page past the last returns no items and the true total. `400` for a bad filter or page. |
| `GET /users/{id}` | none | `200 { id, firstName, lastName, email, role, status, inviteState, createdAt, hasPassword, managerLocked, pendingEmail, updatedAt, version, recordedBy, lastChangedBy }`. `recordedBy` and `lastChangedBy` are `{ id, name, formerStaff }` or `null` ("System" for rows older than Phase 5; `formerStaff: true` after that person was deleted). `404` `users.not-found`. |
| `POST /users` | `{ firstName, lastName, email, role, access, temporaryPassword }` | `201 { id }` with a `Location` header. `access` is `invitation` (no password; a 7-day link is emailed) or `temporary-password` (the Manager hands the password over; it must meet the basic rule, length 8 to 64, a number and a symbol, and the person replaces it at first sign-in; the address stays unconfirmed until the person enters the first emailed sign-in code correctly). With `temporary-password` the address counts as unproved until the person's first correct sign-in code (D-49); until then forgot-password and Send Reset Link send nothing for it. `400` with field messages; a taken email is `400` under `email` ("Another account already uses this email."). The password is never returned, logged, audited or stored in plain text. Needs `Idempotency-Key`. |
| `PUT /users/{id}` | `{ firstName, lastName, role, version, email, emailChange }` | `200` the person as saved. `email` is always required. When it differs from the stored one, `emailChange` must be `confirm` or `now` (`400` under `emailChange` "Choose how the email change applies." otherwise); see "A Manager changes a colleague's email" in [auth.md](auth.md). A role change ends every session of the person at once. `emailChange` `now` also ends every session. Any open reset link stops working with `now`, not with `confirm`. `404`, `409` `edit.stale`, `422` `users.own-account` (a Manager edits themself in My Profile) or `users.last-active-manager` (demoting the last active Manager). |
| `DELETE /users/{id}/email-change` | none | `204`. Calls off a waiting email change. See [auth.md](auth.md). |
| `POST /users/{id}/resend-invitation` | none | `204`. The earlier link stops working and a fresh 7-day link is emailed (never returned). `422` `users.already-set-up` for a person with a password, `422` `users.blocked` for a locked or deactivated one. Needs `Idempotency-Key`. |
| `POST /users/{id}/send-reset-link` | none | `204`. Emails a reset link the person opens themself (30 minutes, once). Counts toward the same hourly cap as forgot-password: `429` `users.reset-link-capped`. `422` `users.blocked` or `users.no-password`. For a person whose email is not confirmed yet nothing is sent and the answer is the same `204` (D-49). Needs `Idempotency-Key`. |
| `POST /users/{id}/temporary-password` | `{ temporaryPassword }` | `204`. Every session of the person ends, a failed-password lockout ends, a notice is emailed, and the next sign-in goes through the emailed code and then asks for a new password. Any open reset link stops working. For an invited person the address stays unproved until their first correct sign-in code (D-49). `400` under `temporaryPassword`; `422` `users.own-account` or `users.blocked`. Needs `Idempotency-Key`. |
| `POST /users/{id}/deactivate` | none | `204`. The person cannot sign in and every session ends at once, so their next request with an old token is `401`. Repeating it is a `204` that changes nothing. Needs `Idempotency-Key`. |
| `POST /users/{id}/activate` | none | `204`. Repeating it is a `204` that changes nothing. Needs `Idempotency-Key`. |
| `POST /users/{id}/lock` | none | `204`. The person cannot sign in, a password reset does not help, and every session ends. The lock has no timer; only a Manager lifts it. It is separate from the 15-minute failed-password lockout. Needs `Idempotency-Key`. |
| `POST /users/{id}/unlock` | none | `204`. Lifts the Manager lock only. Needs `Idempotency-Key`. |
| `DELETE /users/{id}` | none | `204`. Soft delete: the person leaves the roster, every session and link ends, their email is scrambled so the address is free for a new invitation, and records they created keep their name ("(former staff)"). There is no way back. `404` for someone already deleted. `422` `users.own-account` or `users.last-active-manager`. |

Every action above also answers `401` without a valid token, `403` for an Admin, `404` `users.not-found` for an unknown or deleted
person and `409` when two saves lost a race (nothing changed; try again).

### The guard rules (USER-04)

- A Manager cannot lock, deactivate, demote or delete **their own account**: `422` `users.own-account` ("You can't do this to your
  own account.").
- The **last active Manager** cannot be demoted, locked, deactivated or deleted: `422` `users.last-active-manager` ("You can't remove
  the last active Manager."). The check runs inside the same guarded save, so two Managers acting at the same moment cannot both
  succeed.
- Role, status and delete changes end the person's sessions in the same save (USER-05). The person's next request with the old
  session answers `401`.

## Audit Log (AUDIT-02, Manager)

The log is append-only, kept for 8 months, and never edited from the app. IP addresses are stored truncated (/24 for IPv4, /48 for
IPv6).

| Method and path | Answers |
|---|---|
| `GET /audit-log?from&to&actor&action&target&page&pageSize` | `200 { items, total, page, pageSize }`, newest first (by time, then id). Each item is `{ id, occurredAt, doneBy, action, doneTo, detail, ipPrefix, device, reference }`. `doneBy` is `{ kind, person }` with `kind` `user`, `system` or `unknown-account`; `person` is `{ id, name, formerStaff }` for a `user`. `doneTo` is the same `{ id, name, formerStaff }` or `null`. `detail` holds fixed words only (field names and role values, never a name or an email address, D-40). `reference` is the correlation id, to find the request's log lines. With no dates the range is today and the 6 business days before it. `from` and `to` are business days (`YYYY-MM-DD`, Manila time) from the start of the kept window to today; the range includes the whole of both days. `actor` is a user id or `system` and also matches a person's own sign-in, code, reset and invitation steps. `action` is an action code such as `user.deactivated`. `target` is a user id and includes that person's session events. `pageSize` is 1 to 100 (20 when not sent). `400` for a bad filter, date or page. |
| `GET /audit-log/people` | `200` the people the Done by and Done to filters offer: every person ever recorded as staff, active or inactive by name first, then former staff by name. Names only, never an email address. |

Both routes answer `401` without a valid token and `403` for an Admin.

## Error codes

Errors are RFC 9457 problem details; the `code` field holds the machine code, `errors` the field messages.

| Code | Status | When |
|---|---|---|
| `auth.invalid-request` | 400 | Missing or malformed fields; the message is "Check the highlighted fields." and each field's own text is under `errors`. |
| `edit.stale` | 409 | The saved version is no longer the stored one: "This was changed by someone else. Reload and try again." |
| `users.not-found` | 404 | The person does not exist or was deleted: "This user was deleted." |
| `users.own-account` | 422 | A Manager acted on their own account: "You can't do this to your own account." |
| `users.last-active-manager` | 422 | The last active Manager would be removed: "You can't remove the last active Manager." |
| `users.already-set-up` | 422 | Resend invitation for a person who has a password: "This person has already set up their account." |
| `users.blocked` | 422 | The person is locked or deactivated: "Unlock or activate this person first." |
| `users.no-password` | 422 | Reset link for a person who never set a password: "This person hasn't set a password yet. Resend the invitation instead." |
| `users.reset-link-capped` | 429 | Too many reset emails to this person in the last hour: "Too many reset emails went to this person in the last hour. Try again later." |
| `profile.password-locked` | 429 | Five wrong current passwords: "Too many wrong passwords. Try again in 15 minutes." (with `Retry-After`). |
| `email-change.invalid`, `email-change.taken`, `email-change.none` | 404, 409, 404 | See [auth.md](auth.md). |
| `idempotency.key-missing`, `idempotency.key-mismatch`, `idempotency.in-progress` | 400, 422, 409 | See "The Idempotency-Key rule". |

In production a `500` answers "Something went wrong. Reference: <traceId>"; the reference lets support find the log line.

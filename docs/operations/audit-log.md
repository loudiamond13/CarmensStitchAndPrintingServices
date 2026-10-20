---
created: 2026-10-07T12:06:23-05:00
updated: 2026-10-19T03:40:00-05:00
---

# Audit log: append-only design and retention purge

The audit log (`dbo.AuditLog`) records who did what and when: sign-ins, order changes, settings changes and other
staff actions (FND-10, PRD section 11.4). It is evidence, so nobody may change or remove an entry once it is written.
The only exception is the retention purge, which removes entries older than 8 months.

## Owner decision (D-25, D-32)

| | |
|---|---|
| Decision | **Option A: trigger with a narrow, built-in purge path** |
| Retention | **8 months** (the owner changed this from 2 years on 2026-10-07) |
| Decided by | The owner, at the plan 01-09 checkpoint, 2026-10-07 ("Entries older than 8 mos can be deleted.") |
| Recorded as | D-32 in `.planning/phases/01-hosting-verification-backend-foundation/01-CONTEXT.md`, amending D-25 |
| Reversibility | One-way once real audit entries exist (Phase 4 onward). Loosening it later needs a reviewed migration. |

D-32 replaces the "2-year audit retention" that older notes (for example the project `CLAUDE.md`) still mention.

## What "append-only" means here

- **Adding entries** works normally. The application writes them through `IAuditTrail` (`AuditTrail` in
  Infrastructure); see "How handlers write entries" below.
- **Changing an entry** (SQL `UPDATE`) always fails with SQL error **51000**: "AuditLog is append-only: UPDATE is not
  allowed."
- **Removing an entry** (SQL `DELETE`) fails with SQL error **51001**: "AuditLog is append-only: DELETE is not
  allowed." The retention purge below is the only exception.
- **Emptying the table** (SQL `TRUNCATE TABLE`) fails because a foreign key references the table.
- The failed statement and its transaction roll back, so nothing is half-changed.

Entries keep only minimized personal data (D-24): the client address cut to its /24 (IPv4) or /48 (IPv6) network, the
browser family (for example "Chrome") instead of the full User-Agent, and the user's id instead of a name or e-mail.
`Detail` is short plain text. It never holds passwords, codes, tokens, e-mail addresses or phone numbers.

## How it is enforced

There are three layers. The first two live in the database, so they also stop raw SQL from the application's own
login, such as a bug or an injected statement.

1. **Trigger `dbo.TR_AuditLog_AppendOnly`** (`AFTER UPDATE, DELETE`, created by the `AddAuditLog` migration). It raises
   51000 for any update and 51001 for any delete, except the purge case.
2. **Truncate guard `dbo.AuditLogTruncateGuard`.** This is an empty table whose foreign key
   `FK_AuditLogTruncateGuard_AuditLog` points at `AuditLog`. `TRUNCATE` does not fire triggers, but SQL Server refuses to
   truncate a table that a foreign key references. The guard table never holds rows, so it does not get in the way of
   the purge's `DELETE`.
3. **EF Core interceptor `AuditLogAppendOnlyInterceptor`.** If application code tries to save a changed or removed
   audit entry, EF throws `InvalidOperationException` ("AuditLog is append-only: ...") before any SQL is sent. This
   gives a clear error for programming mistakes. The trigger remains the real guarantee.

Integration tests prove each layer: `AuditTrailTests` and `AuditLogAppendOnlyTests` in
`tests/Csps.Infrastructure.IntegrationTests/Auditing`. One test also checks that the trigger exists and is enabled.

## How handlers write entries

`IAuditTrail` has two write paths. A handler commits through `IUnitOfWork` (`SaveChangesAsync`, or
`InTransactionAsync` for several steps that must succeed or fail together).

| Path | What it does | Use it for |
|------|--------------|------------|
| `Record(...)` | Only adds the entry to the request's context. The handler's own `IUnitOfWork.SaveChangesAsync` commits it together with the business change. If the change rolls back, so does the entry. It never saves other tracked changes by itself. | Events that belong to the change: sign-in success, reset completed |
| `RecordIndependentlyAsync(...)` | Writes and saves the entry through its own short-lived database context, so it survives a rollback of the request's change and never saves the request's tracked changes. | Failures that must stay on record: sign-in failed, code failed, reuse detected |

The client address is stored as a /24 (IPv4) or /48 (IPv6) network. Addresses that embed an IPv4 address (IPv4-mapped
`::ffff:a.b.c.d`, 6to4 `2002::/16` and the NAT64 prefix `64:ff9b::/96`) are first mapped to that IPv4, so the visitor's
network is still only a /24.

## Phase 4 auth events (AUDIT-01)

The codes are constants in `Csps.Domain.Auditing.AuditActions`; a test checks that each is valid, unique and at most
64 characters. The target is the thing acted on, by id: `User` (the user id) or `UserSession` (the session id).
Entries never contain an e-mail address, a name, a sign-in code, a token or a password.

| Code | Written when | Target | Detail | Write path |
|------|--------------|--------|--------|------------|
| `auth.sign-in-failed` | A password sign-in is refused | `User` id when the account is known, otherwise none | `unknown-account`, `bad-password`, `locked`, `deactivated`, `unconfirmed`, `no-password` (an invited user who has not set a password yet), `manager-locked` (a Manager locked the account, D-16) or `deleted` (the account was soft-deleted, D-07). The caller still gets the same generic 401 and timing for every reason | `RecordIndependentlyAsync` |
| `auth.lockout` | An account becomes locked after repeated failures | `User` id | `password` or `code` | `Record` for `password`: the sign-in handler (and the My Profile password change, which counts a wrong current password the same way) commits it with the failed-password count and the one lockout e-mail, so the entry exists exactly when the lock does. The `code` path (the tenth wrong code in an hour) is the same: the code handler commits it with the cancelled challenges, the lock and the one lockout e-mail. |
| `auth.2fa-issued` | A sign-in code is created and e-mailed | `User` id | none | `Record` |
| `auth.2fa-resent` | A new sign-in code is requested | `User` id | none | `Record` |
| `auth.2fa-verified` | A sign-in code is entered correctly | `User` id | none | `Record` |
| `auth.2fa-failed` | A wrong sign-in code is entered | `User` id | none | `RecordIndependentlyAsync` |
| `auth.2fa-exhausted` | A sign-in code runs out of attempts | `User` id | none | `RecordIndependentlyAsync` |
| `auth.signed-in` | A sign-in completes and a session starts | `UserSession` id | none | `Record` |
| `auth.refresh-reuse-detected` | A used refresh token is presented again and the session is revoked | `UserSession` id | none | `RecordIndependentlyAsync` |
| `auth.signed-out` | A user signs out of the current session | `UserSession` id | none | `Record` |
| `auth.sessions-revoked` | Several sessions are revoked at once | `User` id | `sign-out-others`, `password-reset` `password-changed` (the person changed their password from My Profile; written only when another device was signed out) or `account-changed` (a Manager deactivated, reactivated, locked, unlocked or deleted the person, or changed their role; written only when a session was open) or `temporary-password` (a Manager set a temporary password for the person; written only when a session was open) | `Record` |
| `auth.session-revoked` | One session is revoked: a deactivated or locked account tries to refresh, or a user signs out one of their other devices (`DELETE /api/v1/sessions/{id}`; nothing is written for a session already gone or refused) | `UserSession` id | none | `Record` |
| `auth.password-reset-requested` | Forgot-password is asked for any address | `User` id; none for an unknown address | `sent` (link emailed), `deactivated` (notice emailed), `manager-locked` (a Manager locked the account: nothing is sent, D-41), `unknown-account` (nothing sent; also an unconfirmed account, such as a temporary-password account before its first correct code, D-49) or `capped` (3 emails in the hour, nothing sent). Never the email or the token | `Record` |
| `auth.password-reset-completed` | A password reset finishes | `User` id | none | `Record` |
| `auth.password-reset-link-invalid` | A reset link is unknown, expired or already used | none | none | `RecordIndependentlyAsync` |
| `auth.password-changed` | A signed-in user changes their own password | `User` id | `profile` (changed from My Profile after entering the current password; the must-change step writes it with no detail). Never either password | `Record`: the change, the revoked sessions, the notice email and the entry commit together |
| `auth.password-breach-found` | A chosen password is refused because it is in a known breach | `User` id when known | none | `RecordIndependentlyAsync` |
| `auth.breach-check-unavailable` | The breached-password lookup could not be reached | `User` id when known | none | `RecordIndependentlyAsync` |
| `auth.invite-accepted` | An invited user sets a password and activates the account | `User` id | none | `Record` |
| `user.bootstrap-manager-created` | The bootstrap command creates the first Manager | `User` id | none | `Record` |
| `user.invited` | A user is invited: by the bootstrap command (first Manager), or by a Manager who adds a user by invitation (`POST /api/v1/users`, access `invitation`) | `User` id (the new account) | `bootstrap` (first Manager, actor System) or `manager` (a Manager added the user; the actor is that Manager). Never the name, email or token | `Record`, in the same transaction as the account, the 7-day link and the invitation email |
| `user.created-temporary` | A Manager adds a user with a temporary password (`POST /api/v1/users`, access `temporary-password`) | `User` id (the new account) | none. Never the password, name or email | `Record`, in the same transaction as the account and its must-change flag; no email is sent |
| `user.deactivated` | A Manager deactivates a user (`POST /api/v1/users/{id}/deactivate`) | `User` id (the person deactivated) | none. Never the name or email. Written only when the state changed, so repeating it adds nothing | `Record`, in the same transaction as the state change, the session revocation and (when a session was open) the `auth.sessions-revoked` entry with detail `account-changed`; the actor is the Manager |
| `user.activated` | A Manager reactivates a user (`POST /api/v1/users/{id}/activate`) | `User` id (the person reactivated) | none. Written only when the state changed | `Record`, in the same transaction as the state change; the actor is the Manager |
| `user.locked` | A Manager locks a user (`POST /api/v1/users/{id}/lock`, D-16). The lock has no timer and a password reset does not lift it | `User` id (the person locked) | none. Never the name or email. Written only when the lock was not already on, so repeating it adds nothing | `Record`, in the same transaction as the lock, the session revocation and (when a session was open) the `auth.sessions-revoked` entry with detail `account-changed`; the actor is the Manager. Locking an active Manager takes the roster lock first and is refused for the last active Manager or the Manager's own account |
| `user.unlocked` | A Manager lifts the Manager lock (`POST /api/v1/users/{id}/unlock`, D-16). The 15-minute failed-password lockout is not touched | `User` id (the person unlocked) | none. Written only when a lock was on | `Record`, in the same transaction as the change and the session revocation; the actor is the Manager |
| `user.deleted` | A Manager deletes a user for good (`DELETE /api/v1/users/{id}`, D-07). The row is kept with its names, the address is scrambled, and there is no restore. A second delete of the same person is a 404 and writes nothing | `User` id (the person deleted) | none. Never the name or email. The entry stays readable because the row keeps the name (D-08) | `Record`, in the same transaction as the scramble, the session and link revocation, the outbox scrub and (when a session was open) the `auth.sessions-revoked` entry with detail `account-changed`; the actor is the Manager. Deleting takes the roster lock first and is refused for the last active Manager or the Manager's own account |
| `user.details-changed` | A Manager saves another person's first name, last name or sign-in email that differs from the stored one (`PUT /api/v1/users/{id}`). The email counts only when it really moved in that save: a person invited but not yet set up always moves at once, and so does a Manager's explicit `emailChange` of `now` (D-45). A confirm-by-link change is `user.email-change-started` instead. A save of the same values, a stale save, an invalid save and a save on the caller's own account write nothing | `User` id (the person edited) | The changed field names joined by commas, from `first-name`, `last-name` and `email`, for example `fields=email` or `fields=first-name,email`. Never the old or new name or address | `Record`, in the same transaction as the save; when the email moved at once for a person who could sign in, it is followed by `auth.sessions-revoked` with detail `account-changed`; the actor is the Manager |
| `user.email-change-started` | A Manager saves another person with a different email and `emailChange` of `confirm` (`PUT /api/v1/users/{id}`): the sign-in email stays, the new address is pending, a 24-hour confirmation link that names the Manager goes to it and a notice goes to the old address (C-9). Not written for a person invited but not yet set up, for `now`, or when the save is refused | `User` id (the person whose email is changing) | None. Never either address | `Record`, in the same transaction as the pending address, the revoked older link, the new link and the two emails; the actor is the Manager. Applying the change later is `profile.email-changed`; calling it off is `profile.email-change-canceled` |
| `user.invitation-resent` | A new invitation replaced the old one. Either a Manager sends it again (`POST /api/v1/users/{id}/resend-invitation`, USER-07, D-13), or a Manager changes the email of a person who has not set up their account (`PUT /api/v1/users/{id}`). In both cases the old link stops working and a fresh 7-day link goes to the person. A person who already has a password, a deactivated or locked person and a deleted or unknown person write nothing | `User` id (the person invited) | None. Never the address or the link | `Record`, in the same transaction as the revoked old link, the new link and the email; the email change also writes `user.details-changed` with `fields=email`; the actor is the Manager |
| `user.reset-link-sent` | A Manager emails a person a password reset link (`POST /api/v1/users/{id}/send-reset-link`, USER-07). The link lasts 30 minutes, works once and replaces any open reset link. It counts toward the same hourly cap of 3 reset emails as forgot-password. A refused request (capped, deactivated or locked person, person with no password, unknown or deleted person) writes nothing, and so does a person whose email is not confirmed yet (nothing is sent and the answer is the same 204, D-49) | `User` id (the person who got the link) | None. Never the address or the link | `Record`, in the same transaction as the revoked older link, the new link and the email; the actor is the Manager. Using the link later is `auth.password-reset-completed` |
| `user.temporary-password-set` | A Manager sets a temporary password for a person (`POST /api/v1/users/{id}/temporary-password`, C-4, 04 D-24). Every session of the person ends, a failed-password lockout ends, and the next sign-in asks for a new password. A password that breaks the basic rule, the caller's own account, a deactivated or locked person and a deleted or unknown person write nothing | `User` id (the person who got the password) | None. Never the password, which is not returned, mailed, logged or kept in the idempotency record | `Record`, in the same transaction as the password, the must-change flag, the session revocation, the "a Manager reset your password" email and (when a session was open) `auth.sessions-revoked` with detail `temporary-password`; the actor is the Manager |
| `user.role-changed` | A Manager saves another person with a different role (`PUT /api/v1/users/{id}`). A save that keeps the role, a stale save, an invalid save, a refused demotion of the last active Manager and a save on the caller's own account write nothing | `User` id (the person edited) | `role=admin>manager` or `role=manager>admin` (old to new, lower case). Never a name or email | `Record`, in the same transaction as the role swap, the revocation of every session of the person and (when a session was open) `auth.sessions-revoked` with detail `account-changed`; a name change in the same save is its own `user.details-changed` entry; the actor is the Manager |

## Phase 5 profile and staff events (USER-06)

Same rules as the Phase 4 table: the target is the thing acted on, by id, and the code is a constant in
`Csps.Domain.Auditing.AuditActions`. **A detail holds field names and role values only, never a person's name or
e-mail address (D-40).** An entry is kept for 8 months and cannot be scrubbed, so a name written here would stay.
Handlers build the target id with `AuditKey.Of(id)` (lower-case `D` format).

| Code | Written when | Target | Detail | Write path |
|------|--------------|--------|--------|------------|
| `profile.name-changed` | A signed-in user saves a first or last name that differs from the stored one (`PUT /api/v1/profile`). A save of the same names, a stale save and an invalid save write nothing | `User` id (the caller's own) | `fields=first-name`, `fields=last-name` or `fields=first-name,last-name`. Never the old or new name | `Record`, in the same transaction as the name save |
| `profile.email-change-requested` | A signed-in user asks to change their sign-in email (`POST /api/v1/profile/email-change`) with the right current password, or asks for the link again while the change waits (`POST /api/v1/profile/email-change/resend`). A wrong password, a refused address, a locked account and a resend with nothing waiting write no such entry (a wrong password that locks the account writes `auth.lockout` instead) | `User` id (the caller's own) | None for the first request; `resent` for a resend. Never either address | `Record`, in the same transaction as the pending address, the 24-hour link and the two emails; a new request replaces the older link in that transaction |
| `profile.email-change-canceled` | A waiting email change ends without applying. Either the caller calls it off (`DELETE /api/v1/profile/email-change`), a Manager calls it off for the person (`DELETE /api/v1/users/{id}/email-change`; the actor is the Manager), or the link is used after another account took the new address (`POST /api/v1/profile/email-change/confirm` answers 409 `email-change.taken`). A cancel with nothing waiting, and the read-only `check`, write nothing | `User` id (the account whose change ended) | None for a cancel by the caller or a Manager; `taken` when the address was taken first. Never either address | `Record`, in the same transaction as the cleared pending address and the revoked or spent links |
| `profile.email-changed` | The new address is confirmed from the emailed link (`POST /api/v1/profile/email-change/confirm`) and becomes the sign-in email. The read-only `check` writes nothing | `User` id (the account that changed) | None. Never either address | `Record`, in the same transaction as the email move and the spent link |

## Viewing the log

Managers read the log on the Audit Log page, which calls `GET /api/v1/audit-log`. It is read only: the page and the
API never change an entry (the log is append-only, see above).

- **Who can see it.** Managers only. An Admin gets 403 and a caller who is not signed in gets 401 (D-26). The answer is
  never cached.
- **Which entries.** With no dates the page shows today and the 6 business days before it, 7 days in all, newest first.
  A day is a business day in Manila time and runs from 00:00 to the end of that day. A Manager can pick any range back
  to the start of the kept window (8 months, D-32) and up to today. Equal times keep the order they were written.
- **Filters.** Done by (a person, or System), Action, Done to (a person) and the two dates. They are applied before
  the page is cut, so the total and the pages always match the filter.
  - Done by a person also finds that person's own steps taken without a token: signing in, entering a code, asking for
    a reset, accepting an invitation.
  - Done to a person also finds events of that person's sessions, such as a sign-out.
  - The Done by and Done to lists come from `GET /api/v1/audit-log/people`: everyone ever recorded as staff, whether
    active, inactive or deleted. Current staff are listed first by name, then former staff by name. Only a name and a
    "former staff" mark are sent, never an email address.
- **The done-by rule.** One rule decides who did it, so the column and the filter agree:
  1. the signed-in person who caused it, when there was one;
  2. otherwise, for the person's own steps taken without a token, the person the entry is about;
  3. otherwise, for a failed sign-in whose address matches no account, an unknown account;
  4. otherwise the System: a job or a command with nobody signed in.
- **What each row shows.** The time, who did it, the action, who it was done to, the detail, the network
  (the stored prefix shown with its length: `/24` for IPv4, `/48` for IPv6), the device (browser family, or
  "Unknown" when none was sent) and the reference (the request's correlation id, to find its log lines).
  Names come from the user's own row, so a deleted person stays named and is marked as former staff (D-08, D-47).
- **Details hold field names and role values only** (for example `fields=email` or `role=admin>manager`), never a
  person's name or email address (D-40). Entries are kept for 8 months and cannot be scrubbed.
- **No export.** There is no download or CSV route (D-29). The log is read on screen only.

## Residual risk

The protection stops application bugs and injected SQL. It does **not** stop a database administrator who acts on
purpose. On the SmarterASP.NET Basic plan the application's login is probably `db_owner`, and a `db_owner` can:

- disable the trigger (`DISABLE TRIGGER`) or drop it;
- drop the truncate guard table or its foreign key;
- then change, delete or truncate audit entries.

Permission `DENY`s would not help, because `db_owner` can undo them. This risk was accepted at the D-25 checkpoint.
To reduce it:

- Keep the database password only in the host's settings, never in git (already the rule).
- Planned for the hardening phase: a runtime check that the trigger exists and is enabled, run from `/health` or the
  maintenance job, so a disabled trigger is noticed. Until then, check by hand after each deployment:

  ```sql
  SELECT name, is_disabled
  FROM sys.triggers
  WHERE parent_id = OBJECT_ID(N'dbo.AuditLog');
  -- Expect one row: TR_AuditLog_AppendOnly, is_disabled = 0.
  ```

- The trigger is first proven on the host when the first deployment applies the migration (Phase 3). The Basic plan's
  only database is the live legacy one (D-28), so there is no earlier test there.

## Retention purge (hardening phase)

Retention is **8 months**. The purge job itself is built in the hardening phase, as a short, idempotent endpoint that
a GitHub Actions schedule calls with a secret (the host has no scheduler). The trigger already allows exactly this
path and nothing wider:

- The connection must set the **read-only** session flag `csps.audit_purge = 1`.
- **Every** row the statement deletes must be older than 8 months (`OccurredAtUtc < DATEADD(month, -8,
  SYSUTCDATETIME())`). If even one row is newer, the whole statement fails with 51001 and nothing is deleted.
- Recent entries can never be deleted, even with the flag. Nothing can ever be edited.

### Recipe

1. Open a **dedicated, non-pooled** connection (`Pooling=false` in the connection string). With pooling, a session
   setting could survive on a connection the application reuses later (research Pitfall 11).
2. Set the flag as read-only, so nothing later on that connection can turn it off or change it:

   ```sql
   EXEC sp_set_session_context @key = N'csps.audit_purge', @value = 1, @read_only = 1;
   ```

3. Delete old entries in small batches, repeating until a batch deletes nothing, to keep locks and the log short on the
   shared host:

   ```sql
   DELETE TOP (500) FROM dbo.AuditLog
   WHERE OccurredAtUtc < DATEADD(month, -8, SYSUTCDATETIME());
   ```

4. Close the connection. Record the count removed as an audit entry of its own, on a normal connection.

The `IX_AuditLog_OccurredAtUtc` index serves the purge's date filter. `AuditLogAppendOnlyTests.PurgeFlagDeletesOnlyOldRows`
and `PurgeFlagRefusesRowJustInsideEightMonths` prove this behavior: a 9-month-old entry can be purged, while today's
entry and one just inside 8 months are refused.

Anyone with database access who learns the flag name could also delete entries older than 8 months. Retention allows
that anyway, so the owner accepted it with option A.

## Tests and Respawn

Respawn resets test databases with `DELETE`, which the trigger rejects. `CspsDatabase` therefore never resets
`AuditLog` or `AuditLogTruncateGuard`. Audit tests find their own rows by a fresh correlation id.

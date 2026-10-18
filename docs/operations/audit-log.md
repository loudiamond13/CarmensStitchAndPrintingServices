---
created: 2026-10-07T12:06:23-05:00
updated: 2026-10-18T00:45:00-05:00
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
| `auth.sessions-revoked` | Several sessions are revoked at once | `User` id | `sign-out-others`, `password-reset` or `password-changed` (the person changed their password from My Profile; written only when another device was signed out) | `Record` |
| `auth.session-revoked` | One session is revoked: a deactivated or locked account tries to refresh, or a user signs out one of their other devices (`DELETE /api/v1/sessions/{id}`; nothing is written for a session already gone or refused) | `UserSession` id | none | `Record` |
| `auth.password-reset-requested` | Forgot-password is asked for any address | `User` id; none for an unknown address | `sent` (link emailed), `deactivated` (notice emailed), `manager-locked` (a Manager locked the account: nothing is sent, D-41), `unknown-account` (nothing sent; also an unconfirmed account) or `capped` (3 emails in the hour, nothing sent). Never the email or the token | `Record` |
| `auth.password-reset-completed` | A password reset finishes | `User` id | none | `Record` |
| `auth.password-reset-link-invalid` | A reset link is unknown, expired or already used | none | none | `RecordIndependentlyAsync` |
| `auth.password-changed` | A signed-in user changes their own password | `User` id | `profile` (changed from My Profile after entering the current password; the must-change step writes it with no detail). Never either password | `Record`: the change, the revoked sessions, the notice email and the entry commit together |
| `auth.password-breach-found` | A chosen password is refused because it is in a known breach | `User` id when known | none | `RecordIndependentlyAsync` |
| `auth.breach-check-unavailable` | The breached-password lookup could not be reached | `User` id when known | none | `RecordIndependentlyAsync` |
| `auth.invite-accepted` | An invited user sets a password and activates the account | `User` id | none | `Record` |
| `user.bootstrap-manager-created` | The bootstrap command creates the first Manager | `User` id | none | `Record` |
| `user.invited` | A user is invited | `User` id | none | `Record` |

## Phase 5 profile and staff events (USER-06)

Same rules as the Phase 4 table: the target is the thing acted on, by id, and the code is a constant in
`Csps.Domain.Auditing.AuditActions`. **A detail holds field names and role values only, never a person's name or
e-mail address (D-40).** An entry is kept for 8 months and cannot be scrubbed, so a name written here would stay.
Handlers build the target id with `AuditKey.Of(id)` (lower-case `D` format).

| Code | Written when | Target | Detail | Write path |
|------|--------------|--------|--------|------------|
| `profile.name-changed` | A signed-in user saves a first or last name that differs from the stored one (`PUT /api/v1/profile`). A save of the same names, a stale save and an invalid save write nothing | `User` id (the caller's own) | `fields=first-name`, `fields=last-name` or `fields=first-name,last-name`. Never the old or new name | `Record`, in the same transaction as the name save |

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

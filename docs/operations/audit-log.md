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
  Infrastructure).
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

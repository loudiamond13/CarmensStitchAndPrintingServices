# Runbook: create the first Manager on an empty database

*Created: 2026-10-15T07:36:00-05:00 · Updated: 2026-10-15T07:36:00-05:00*

A new CSPS database has no staff accounts, so nobody can sign in. The `bootstrap-manager` command creates the first Manager and queues one email invite. The Manager opens the link, sets a password, and signs in with the 6-digit code that CSPS emails (AUTH-12, D-29).

## When to run it

- Once, after the first deploy, on a freshly migrated database with no Manager (Phase 3).
- On your own machine, against `CSPS_Dev` or `CSPS_E2E`, to get a working login (see "Signing in locally" in [the developer guide](../development.md)).
- The command refuses to run again while any active Manager exists. It can be re-run only while there is no active Manager, for example after the only Manager was deactivated.

It never migrates. Apply the reviewed migration script first; the command refuses a database that is missing migrations.

## What must be ready first

1. The database is migrated and has no active Manager.
2. The CSPS site is running with working SMTP. The command only queues the invite. The running site sends it within a minute, so with no site or broken mail the invite never leaves. Mail setup is in [mail-setup.md](mail-setup.md).
3. The command uses the same Data Protection certificate as the site, because the queued email is stored encrypted with the site's key ring. Set `DataProtection__CertificateBase64` and `DataProtection__CertificatePassword` for this terminal the way the site has them. In Development, set `DOTNET_ENVIRONMENT` to `Development` for this terminal and they come from your user-secrets.

## How to run it

The connection string is a secret, so the command never takes it as an argument (it would stay in the shell history and be visible to other programs). Give it in one of two ways:

- Set the environment variable for this terminal only, never for your user or the machine:

  ```powershell
  $env:CSPS_BOOTSTRAP_CONNECTION = '<connection string>'
  ```

- Or leave `CSPS_BOOTSTRAP_CONNECTION` unset. The command then asks for it at a hidden prompt.

Then run:

```powershell
dotnet run --project tools/Csps.BootstrapManager -- --email carmen@example.com --first-name Carmen --last-name Reyes --confirm-database <database name> --public-base-url https://<the site address>
```

| Argument | Meaning |
|---|---|
| `--email` | The new Manager's sign-in email. The invite goes here. |
| `--first-name`, `--last-name` | The Manager's name. |
| `--confirm-database` | The database name again, exactly as in the connection string. A mismatch is refused, so a wrong connection string cannot slip through. |
| `--public-base-url` | The site address the invite link points to. Optional if `App:PublicBaseUrl` is already set. |

A connection argument such as `--connection` is rejected. Close the terminal, or run `Remove-Item Env:CSPS_BOOTSTRAP_CONNECTION`, when you are done.

## What you see

| Exit code | Meaning |
|---|---|
| 0 | Done. The line `Invite queued for <email>. The running CSPS site sends it within a minute.` is printed. |
| 2 | Refused, and nothing was created: the wrong or unconfirmed database, a database that is not migrated, an active Manager already exists, or the email already belongs to an account. |
| 64 | A problem with the arguments or settings, such as a bad email or an unusable site address. |
| 1 | Failed, for example the database could not be reached. Messages never include the connection string. |

The command never touches a `BetsLLC_*` database, `CSPS_Legacy_Restore` or a SQL Server system database. On this machine it works only on `CSPS_Dev`, `CSPS_E2E` and `CSPS_Test_<guid>`.

## After it runs

1. The invite email arrives at the address. The link works once and lasts 72 hours.
2. The Manager opens the link, sets a password, and signs in. Sign-in always ends with the emailed code.
3. Every step is recorded in the audit log with the System actor: no user, no address, no session.

If the 72 hours pass unused, the unaccepted account still counts as an active Manager, so the command refuses a second run. Resending an invite belongs to staff management in a later phase. Until then, an unused first account can only be cleared with a reviewed one-off database script, which needs the developer. It is safe because an unused account holds no data.

## When mail breaks

If CSPS cannot send email, nobody can finish signing in. The fix is the SMTP settings, never a way around the code:

1. Check the site's SMTP settings and the mailbox against [mail-setup.md](mail-setup.md).
2. Correct them and restart the site. Queued emails are sent once mail works, until they expire.
3. If the invite expired meanwhile, see "After it runs" above.

There is no bypass of the emailed code. No command, flag, setting or database edit signs a person in without it, and none will be added. A request to add one is a request to weaken staff-account security and needs the owner's explicit decision on record.

# SmarterASP.NET Hosting Record (FND-13)

D-28 decision: option-a (2026-10-07) - a separate, throwaway probe site next to the live site (never on top of it) plus look-only (SELECT) database queries that the owner runs in the control panel.

This file records the facts about the SmarterASP.NET hosting that CSPS depends on. The owner reads them in the
control panel, in the database query tool and from a one-time probe, then pastes the answers back. Claude fills in
the Facts table from what was pasted. The checks are run in plan 01-13. Nothing here was guessed: a fact that was not
seen stays **Unverified** (D-09).

## Status legend

| Status | Meaning |
|--------|---------|
| Verified | Seen by the owner. The Result column holds what was seen and the Date column the day it was seen (yyyy-MM-dd). |
| Unverified | Not seen yet, or could not be checked. Result and Date stay "-". Later phases must not rely on it. |
| N/A | Does not apply to this account. The Result column says why. |

## Safety rules (read before every step)

1. **The live site and its database are never changed.** Nothing is created, edited, restarted, deployed or deleted
   on the live site, in its folder or in its database (`csptailoringdb`).
2. **Database queries only look.** Every query in section B starts with `SELECT` and only reads. If the query tool
   ever asks to save, commit or apply changes, stop and ask first.
3. **The probe goes on its own temporary site.** Create one small extra site or sub-address next to the live site
   (never inside the live site's folder), use it once, then delete it.
4. **Never paste secrets.** Do not paste passwords, login names for the database, connection strings, the probe's
   secret key or any private key into the chat, this file or git. If a screen shows one of these, leave it out.
5. **Mask your own address.** When an answer shows your own IP address, replace its last number with `x`
   (for example `203.0.113.x`).

## A. Control-panel screens (look only)

Open each screen, read the value, and paste it back with its letter and number (for example "A3: 1 GB").

| Step | What to look at | What to copy back |
|------|-----------------|-------------------|
| A1 | Account or billing page: hosting plan | The plan name (for example "Basic") |
| A2 | Databases page | How many databases the plan allows and how many are in use |
| A3 | Databases page or plan page | The database size limit (quota) |
| A4 | Site settings: .NET / ASP.NET version list | Every .NET version offered (for example ".NET 10") |
| A5 | Sites list and Databases list | Whether the live legacy site and `csptailoringdb` are in this same account (yes or no) |
| A6 | Site settings | How a site gets its settings (environment variables screen, web.config editing, or not offered) |
| A7 | Site tools or deployment page | Whether Web Deploy is offered (yes or no) |
| A8 | Tools or scheduled tasks page | Whether scheduled tasks are offered on this plan (yes or no) |
| A9 | Sites page or plan page | Whether a staging site or staging slot is offered (yes or no) |

## B. Look-only database queries (allowed by the D-28 decision)

Run these in the control panel's database query tool on the live database. Each one only reads. Copy each query
exactly, run it, and paste back the result grid as text with its number (B1 to B6). Leave out any login name or
password the tool shows.

**B1. SQL Server version**

```sql
SELECT @@VERSION AS Version;
```

**B2. Version, update level, edition and server collation**

```sql
SELECT SERVERPROPERTY('ProductVersion') AS ProductVersion, SERVERPROPERTY('ProductLevel') AS ProductLevel, SERVERPROPERTY('Edition') AS Edition, SERVERPROPERTY('Collation') AS ServerCollation;
```

**B3. Compatibility level and settings.** The `model` row is what a brand-new CSPS database would get. The other row
is the live database.

```sql
SELECT name, compatibility_level, collation_name, is_read_committed_snapshot_on, recovery_model_desc FROM sys.databases WHERE name IN ('model', DB_NAME());
```

If only one row comes back, paste that one row. It means the account cannot see `model`, and that fact stays
Unverified.

**B4. Space the live database uses now**

```sql
SELECT CAST(SUM(size) * 8.0 / 1024 AS decimal(10,1)) AS AllocatedMB FROM sys.database_files;
```

**B5. Whether the hosting login owns the database.** Paste only the `IsDbOwner` value (1 or 0). Leave out the
`DbUser` name.

```sql
SELECT USER_NAME() AS DbUser, IS_MEMBER('db_owner') AS IsDbOwner;
```

**B6. What the hosting login is allowed to do**

```sql
SELECT permission_name FROM fn_my_permissions(NULL, 'DATABASE') ORDER BY 1;
```

**The append-only trigger test is NOT run on the live database.** It would create and drop a table, and the Basic
plan has no spare scratch database. That check stays in our own test databases until cutover planning.

## C. One-time probe on a separate site (allowed by the D-28 decision)

Full steps with commands: `tools/Csps.HostProbe/README.md`. In short:

1. Claude builds the probe package (`dotnet publish tools/Csps.HostProbe -c Release -o artifacts/hostprobe`). The
   package is never committed to git.
2. Make a fresh secret key of 32 or more random characters (README step 2). Put it only in the **published**
   `artifacts/hostprobe/appsettings.json`, never in the copy under `tools/`, never in chat and never in git.
3. In the control panel, create a **new, separate** site or sub-address. It must not share a folder with the live
   site. Choose the newest .NET version if asked.
4. Upload everything inside `artifacts/hostprobe` to the new site only.
5. Open the probe once from PowerShell:
   `curl.exe -s -w "\nHTTP %{http_code}\n" -H "X-Probe-Key: <your-probe-key>" https://<probe-site>/probe`
6. Paste back the `{ ... }` answer. Replace the last number of your own IP address with `x`, and make sure the key
   is not in what you paste.
7. **Delete the probe site and its folder** in the control panel, run the command in step 5 again to confirm it no
   longer answers, and throw the key away.

## D. Email sender and DNS (last, D-12)

This part waits until the owner names the live site's domain (the email sender uses that domain).

1. Record the existing DNS text records. In PowerShell:
   - `nslookup -type=TXT <domain>`
   - `nslookup -type=TXT _dmarc.<domain>`

   Paste back the lines that start with `v=spf1` and `v=DMARC1` (they are public, not secret).
2. Send a test email from the host mailbox to a Gmail address. In Gmail open the message, choose
   "Show original", and paste back only the three lines that show the SPF, DKIM and DMARC results (PASS or FAIL).
3. **Merge, never replace.** If the SPF record needs the host's mail server added, it is added **into the one
   existing** `v=spf1` record. A domain must never have two SPF records, because two records make SPF fail for every
   message. The same care applies to DKIM and DMARC: add to what exists, and never change anything the live site
   uses to receive or send mail.
4. No DNS change is made during these checks. Any change is planned separately and must not disturb the live site.

## Facts

| Fact | How to check | Result | Status | Date |
|------|--------------|--------|--------|------|
| Plan name | A1 | - | Unverified | - |
| Databases allowed / used | A2 | - | Unverified | - |
| Database size quota | A3 | - | Unverified | - |
| .NET versions offered | A4 | - | Unverified | - |
| Legacy site and database in this account | A5 | - | Unverified | - |
| App settings method | A6 | - | Unverified | - |
| Web Deploy availability | A7 | - | Unverified | - |
| Scheduler availability | A8 | - | Unverified | - |
| Staging-site option | A9 | - | Unverified | - |
| SQL Server @@VERSION | B1 | - | Unverified | - |
| SQL Server product level and edition | B2 | - | Unverified | - |
| Server collation | B2 (ServerCollation) | - | Unverified | - |
| Database compatibility level (new databases / model) | B3 (`model` row) | - | Unverified | - |
| Legacy database settings | B3 (live database row) | - | Unverified | - |
| Database allocated size | B4 | - | Unverified | - |
| Hosting login owns the database | B5 (IsDbOwner only) | - | Unverified | - |
| Hosting login permissions | B6 | - | Unverified | - |
| .NET runtime patch | C probe: frameworkDescription, environmentVersion | - | Unverified | - |
| In-process hosting | C probe: processName, inProcess | - | Unverified | - |
| Content root vs current directory | C probe: contentRootPath, currentDirectory | - | Unverified | - |
| Logs folder writable | C probe: logsWritable | - | Unverified | - |
| Client IP / proxy topology | C probe: remoteIpAddress, xForwardedFor, xRealIp, cfConnectingIp | - | Unverified | - |
| HTTPS termination | C probe: isHttps, xForwardedProto | - | Unverified | - |
| Asia/Manila and en-PH available | C probe: manilaZone, enPhCulture | - | Unverified | - |
| PFX EphemeralKeySet round trip | C probe: ephemeralPfxRoundTrip | - | Unverified | - |
| App pool memory available | C probe: totalAvailableMemoryBytes | - | Unverified | - |
| Sender domain | Owner names the live site's domain | - | Unverified | - |
| SPF | D1 and D2 | - | Unverified | - |
| DKIM | D2 | - | Unverified | - |
| DMARC | D1 and D2 | - | Unverified | - |

## Consequences for later phases

- **Compatibility level (D-13).** The EF Core compatibility level stays pinned at 160 for now. Plan 01-13 re-pins
  it to the `model` level from B3 once that fact is Verified, and the idempotent script is re-tested at that level.
  If it stays Unverified, 160 remains the provisional pin and the record is re-checked before cutover planning.
- **Forwarded headers.** The API keeps ignoring `X-Forwarded-For` and similar headers (ForwardedHeadersTests)
  until "Client IP / proxy topology" is Verified. Only then may a later plan turn on forwarded-headers handling,
  limited to the proxy addresses the probe actually showed.
- **Scheduled jobs (D-10).** The Basic plan has no host scheduler. Scheduled jobs run from a GitHub Actions cron
  that calls a secret-protected endpoint.
- **No staging (D-11, amends OPS-04).** There is no staging site. Production deploys need a manual approval after CI
  passes, and any smoke check runs against production after the deploy.
- **CI never touches the hosted database (D-10).** Tests use LocalDB on this computer and a SQL Server container in
  CI. Nothing automated connects to the SmarterASP.NET database.
- **Re-check before relying on it.** These facts are only as current as their dates. A host upgrade can change the
  runtime patch or the compatibility level, so the record is re-verified before Phase 3's first deploy and before
  the Phase 17 cutover.

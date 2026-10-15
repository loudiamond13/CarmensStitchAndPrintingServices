# SmarterASP.NET Hosting Record (FND-13)

*Created: 2026-10-07T11:10:20-05:00 · Updated: 2026-10-15T11:32:00-05:00*

D-28 decision: option-a (2026-10-07) - a separate, throwaway probe site next to the live site (never on top of it) plus look-only (SELECT) database queries that the owner runs in the control panel.

This file records the facts about the SmarterASP.NET hosting that CSPS depends on. The owner reads them in the
control panel, in the database query tool and from a one-time probe, then pastes the answers back. Claude fills in
the Facts table from what was pasted. The checks are run in plan 01-13. Nothing here was guessed: a fact that was not
seen stays **Unverified** (D-09).

**Results received 2026-10-07 (plan 01-13).** The owner ran sections A and B and step D1, and pasted the results.
Section C (the probe) was **not run**: the Basic plan does not let the owner create a free extra site, so no probe
site was created or deleted, and every probe fact stays Unverified. Step D2 (the Gmail "Show original" check) has not
been done yet. The account prefix of the database name is masked as `db_…_csptailoringdb`.

## Status legend

| Status | Meaning |
|--------|---------|
| Verified | Seen by the owner. The Result column holds what was seen and the Date column the day it was seen (yyyy-MM-dd). |
| Unverified | Not seen yet, or could not be checked. The Result column says why, and Date stays "-". Later phases must not rely on it. |
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

**Not run (2026-10-07).** The Basic plan does not let the owner create a free extra site, so this section was
skipped. The steps below stay for the first real deploy (Phase 3), where the same facts can be read from the CSPS
site itself.

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

This part waits until the owner names the live site's domain (the email sender uses that domain). The owner named
it on 2026-10-07: `cspstailoring.com` (public, not secret).

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
| Plan name | A1 | .NET Basic | Verified | 2026-10-07 |
| Databases allowed / used | A2 | 1 allowed, 1 in use | Verified | 2026-10-07 |
| Database size quota | A3 | 1000 MB | Verified | 2026-10-07 |
| .NET versions offered | A4 | .NET 10 (the version the owner uses; no other versions were listed in the reply) | Verified | 2026-10-07 |
| Legacy site and database in this account | A5 | Yes: the live legacy site and the live database (`db_…_csptailoringdb`) are in this account | Verified | 2026-10-07 |
| App settings method | A6 | Environment variables in the app-pool manager, and web.config | Verified | 2026-10-07 |
| Web Deploy availability | A7 | Yes (FTP is also offered) | Verified | 2026-10-07 |
| Scheduler availability | A8 | No | Verified | 2026-10-07 |
| Staging-site option | A9 | No | Verified | 2026-10-07 |
| SQL Server @@VERSION | B1 | Microsoft SQL Server 2022 (RTM-CUxx) (KBxxxxxxx) - 16.0.x (X64), Web Edition (64-bit) on Windows Server 2022 Standard 10.0 (Build 20348) (Hypervisor) | Verified | 2026-10-07 |
| SQL Server product level and edition | B2 | ProductVersion 16.0.x, ProductLevel RTM, Edition Web Edition (64-bit) | Verified | 2026-10-07 |
| Server collation | B2 (ServerCollation) | SQL_Latin1_General_CP1_CI_AS | Verified | 2026-10-07 |
| Database compatibility level (new databases / model) | B3 (`model` row) | Not returned: B3 gave only the live database row, so this account cannot see `model` and the server default is unknown | Unverified | - |
| Legacy database settings | B3 (live database row) | `db_…_csptailoringdb`: compatibility_level 150, collation SQL_Latin1_General_CP1_CI_AS, is_read_committed_snapshot_on 0, recovery SIMPLE | Verified | 2026-10-07 |
| SQL Server 2025 offered | Service-desk ticket (owner, 2026-10-07) | Yes: a new SQL Server 2025 database can be created in the control panel. There is no in-place upgrade; the live data moves by restoring a .bak into the new database. Not answered: extra cost, and whether the Basic plan's 1-database limit allows a second database | Verified | 2026-10-07 |
| Database allocated size | B4 | AllocatedMB 16.0 | Verified | 2026-10-07 |
| Hosting login owns the database | B5 (IsDbOwner only) | IsDbOwner 1 (the hosting login is a member of db_owner) | Verified | 2026-10-07 |
| Hosting login permissions | B6 | db_owner-level: CONTROL plus all DDL/DML (among them CONTROL, ALTER, CREATE TABLE, BACKUP DATABASE and ALTER ANY DATABASE DDL TRIGGER); the full list was provided by the owner | Verified | 2026-10-07 |
| .NET runtime patch | C probe: frameworkDescription, environmentVersion | Probe not possible: the plan allows no extra site. The live legacy app's web.config (owner-pasted 2026-10-07) runs framework-dependent (`processPath="dotnet"`) and the owner says it targets .NET 10, so a .NET 10 shared runtime is installed. The exact patch is checked on the first real deploy (Phase 3) | Unverified | - |
| In-process hosting | C probe: processName, inProcess; or the live legacy app's web.config (owner-pasted) | The live legacy app's web.config uses AspNetCoreModuleV2 with `hostingModel="inprocess"`, so the host runs ASP.NET Core in-process | Verified | 2026-10-07 |
| Content root vs current directory | C probe: contentRootPath, currentDirectory | Probe not possible: the plan allows no extra site. Verify on the first real deploy (Phase 3) | Unverified | - |
| Logs folder writable | C probe: logsWritable | Probe not possible: the plan allows no extra site. Verify on the first real deploy (Phase 3) | Unverified | - |
| Client IP / proxy topology | C probe: remoteIpAddress, xForwardedFor, xRealIp, cfConnectingIp | Probe not possible: the plan allows no extra site. Verify on the first real deploy (Phase 3) | Unverified | - |
| HTTPS termination | C probe: isHttps, xForwardedProto | Probe not possible: the plan allows no extra site. Outside view of the live site (2026-10-07): IIS 10 serves a Let's Encrypt certificate and http answers 307 to https, so TLS ends at IIS. What the app itself sees is checked on the first real deploy (Phase 3) | Unverified | - |
| Asia/Manila and en-PH available | C probe: manilaZone, enPhCulture | Probe not possible: the plan allows no extra site. Verify on the first real deploy (Phase 3) | Unverified | - |
| PFX EphemeralKeySet round trip | C probe: ephemeralPfxRoundTrip | Probe not possible: the plan allows no extra site. Verify on the first real deploy (Phase 3) | Unverified | - |
| App pool memory available | C probe: totalAvailableMemoryBytes | Probe not possible: the plan allows no extra site. Verify on the first real deploy (Phase 3) | Unverified | - |
| Sender domain | Owner names the live site's domain | cspstailoring.com | Verified | 2026-10-07 |
| SPF | D1 (DNS record on cspstailoring.com) | `v=spf1 a mx include:_spf.site4now.net -all` | Verified | 2026-10-07 |
| DKIM | D2 | `dkim=pass header.i=@cspstailoring.com header.s=8DF2A53DE38DCC0` (Gmail "Show original"); the DKIM TXT record is published at `8DF2A53DE38DCC0._domainkey.cspstailoring.com` and was seen from 8.8.8.8 | Verified | 2026-10-14 |
| DMARC | D1 (DNS record on _dmarc.cspstailoring.com) | `v=DMARC1;p=reject;pct=100;rua=mailto:postmaster@cspstailoring.com` | Verified | 2026-10-07 |
| SPF / DKIM / DMARC pass in Gmail | D2 | Message from no-reply@cspstailoring.com: `spf=pass` (sender allowed via site4now.net), `dkim=pass` (header.i=@cspstailoring.com), `dmarc=pass` (p=REJECT sp=REJECT dis=NONE, header.from=cspstailoring.com). Still exactly one SPF record, `_dmarc` unchanged | Verified | 2026-10-14 |
| Sender mailbox | D-26, D-34 (mail-setup.md step 1) | `no-reply@cspstailoring.com`; the app sets its own From display name "Carmen's Stitch & Printing" and no Reply-To (the mailbox's own webmail display name is "Carmens Stitch and Printing Services", which the app does not use) | Verified | 2026-10-14 |
| Dev runtime | D-35 (`dotnet --list-runtimes`, `dotnet --list-sdks`) | ASP.NET Core 10.0.13, SDK 10.0.402 (D-35, this machine; the host runtime is verified on the Phase 3 first deploy) | Verified | 2026-10-14 |

## Phase 3 first-deploy checks added by Phase 4

Phase 4 (identity and authentication) was built and tested locally while the first real deploy (Phase 3) is deferred.
Everything below is something Phase 4 depends on that no one has seen on the real host yet. Each row stays
**Unverified** until the Phase 3 first deploy: verify it on that deploy and then move it into the Facts table with the
owner's observed result and the date (D-09). Nothing here may be relied on before then.

| Check | How to check | Result | Status | Date |
|-------|--------------|--------|--------|------|
| Outbound SMTP from the site (port 587, or 465) to the SmarterASP.NET mail server | First deploy: send the sign-in code to a real mailbox from the deployed site (assumption A6) | Not checked: needs the deployed site. Verify on the Phase 3 first deploy | Unverified | - |
| Outbound HTTPS to the breached-password service (`api.pwnedpasswords.com`) | First deploy: set a password and watch the audit log for `auth.breach-check-unavailable` (research Pitfall 12) | Not checked: needs the deployed site. Verify on the Phase 3 first deploy | Unverified | - |
| ASP.NET Core 10.0.13 (or newer) runtime on the host | First deploy: the app's startup line, or the probe's runtime field (D-35) | Not checked: the host runtime has not been seen. Verify on the Phase 3 first deploy; otherwise publish self-contained `win-x64` | Unverified | - |
| `Set-Cookie` for `__Secure-csps_rt` and `__Secure-csps_2fa` on the production HTTPS host | First deploy: sign in once and look at the cookies in the browser (both `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`) | Not checked: needs the deployed site and its HTTPS termination. Verify on the Phase 3 first deploy | Unverified | - |
| `AllowedHosts` set to the real host names | First deploy: the production settings name the real domains, and a request with another Host header is refused (IN-06) | Not checked: needs the deployed site. Verify on the Phase 3 first deploy | Unverified | - |
| web.config `requestLimits` honoured by IIS | First deploy: an oversized request body is refused by IIS before the app (assumption A14) | Not checked: needs the deployed site. Verify on the Phase 3 first deploy | Unverified | - |
| Client IP and proxy topology before the per-address limits are trusted (D-39) | First deploy: the Facts row "Client IP / proxy topology" above; until it is Verified the limits see the proxy's address | Not checked: see the Facts row. Verify on the Phase 3 first deploy | Unverified | - |
| Data Protection certificate and `App:PublicBaseUrl` available to the bootstrap command on the host | First deploy: run the bootstrap command (docs/operations/bootstrap-manager.md) with the host's settings and see it reach the invite email | Not checked: needs the deployed site and its secrets. Verify on the Phase 3 first deploy | Unverified | - |
| The real bootstrap on the hosted database, then the first sign-in with an emailed code (AUTH-12) | First deploy: create the first Manager, open the invite link, set a password, sign in and enter the emailed code | Not checked: needs the deployed site. Verify on the Phase 3 first deploy | Unverified | - |

## Consequences for later phases

- **Database version target (D-33, owner, 2026-10-07).** The host runs SQL Server 2022 today, but the owner's
  target production database is **SQL Server 2025**. The owner plans to retire the current SQL Server 2022 database
  hosting and restore the live data onto a SQL Server 2025 database. Notes for that move:
  - Restoring a SQL Server 2022 backup onto SQL Server 2025 is supported. The database keeps its old compatibility
    level after the restore, and the level is raised afterwards.
  - SmarterASP.NET answered (2026-10-07): SQL Server 2025 is offered. There is no in-place upgrade; create a new
    SQL Server 2025 database in the control panel and restore a .bak of the live database into it. Still to ask:
    whether it costs anything extra (an owner decision under the free-only rule, D-00), and whether the Basic plan
    allows a second database while the live one still exists.
  - The Basic plan allows only 1 database, and it is in use. Deleting the current database first would take the
    live legacy site down until the restore finishes. Take a fresh backup first. An in-place upgrade is not offered,
    so ask SmarterASP.NET whether a temporary second database is allowed.
  - Timing: only during cutover planning and execution (Phases 15-17; only Phase 17 touches the live system), never
    before. The live site must stay up (Prime Directive 1).
- **Live site certificate (observed 2026-10-07).** The live site's Let's Encrypt certificate expires 2026-10-13.
  These normally renew about 30 days before expiry, so automatic renewal may be failing. The owner checks the SSL
  section of the control panel or asks SmarterASP.NET. This is not CSPS work, but it affects the live site.
- **Compatibility level (D-13, D-33).** `SqlCompatibility.Level` stays at **160, provisional**. It is not re-pinned
  now: the `model` level is Unverified (B3 returned no `model` row), and the owner's target is SQL Server 2025.
  160 is valid on both SQL Server 2022 and 2025, and the idempotent script is proven at 160 and 170
  (MigrationScriptTests). Re-pin to **170** only after the SQL Server 2025 database exists and its level is
  verified, then re-run MigrationScriptTests. CI's SQL Server 2025 container image stays as planned, which matches
  the target. The live legacy database itself is at level 150.
- **Append-only audit log (D-25, D-32).** The hosting login is db_owner (B5) with CONTROL and full DDL rights (B6),
  so `DENY` permissions could not stop it. This confirms the trigger-based append-only design.
- **Database size.** The quota is 1000 MB and the live database uses 16.0 MB today, so space is not a near-term
  concern. Re-check it before cutover.
- **App settings and secrets (Phase 3).** Settings can come from environment variables in the app-pool manager or
  from web.config. Secrets (the JWT signing key, the Data Protection PFX and its password, the connection string)
  go into app-pool environment variables, never into a committed web.config.
- **Deploys (Phase 3).** Web Deploy is offered (FTP too), so the deploy job uses Web Deploy.
- **Probe facts (Phase 3).** The probe could not run, so the runtime patch, in-process hosting, content root, logs
  folder, client IP and proxy topology, HTTPS termination, Asia/Manila and en-PH, the PFX EphemeralKeySet load and
  app-pool memory are all Unverified. Phase 3 verifies them on the first real deploy. If the runtime patch is below
  what the app needs, Phase 3 publishes self-contained `win-x64`.
- **Forwarded headers.** The API keeps ignoring `X-Forwarded-For` and similar headers (ForwardedHeadersTests)
  until "Client IP / proxy topology" is Verified. Only then may a later plan turn on forwarded-headers handling,
  limited to the proxy addresses actually seen.
- **Email (Phase 4, D-12).** The SPF record ends in `-all` and DMARC is `p=reject`, so mail that fails is rejected,
  not just marked. The app must send through SmarterASP.NET's mail servers (covered by
  `include:_spf.site4now.net`) with DKIM aligned to `cspstailoring.com`. Any other sending service must be **merged
  into the one existing SPF record**, never added as a second record. The Gmail SPF/DKIM/DMARC pass check (D2) passed on 2026-10-14 (see Facts),
  so Phase 4 may send mail through the host.
- **Scheduled jobs (D-10).** The Basic plan has no host scheduler (A8). Scheduled jobs run from a GitHub Actions
  cron that calls a secret-protected endpoint.
- **No staging (D-11, amends OPS-04).** There is no staging site (A9). Production deploys need a manual approval
  after CI passes, and any smoke check runs against production after the deploy.
- **CI never touches the hosted database (D-10).** Tests use LocalDB on this computer and a SQL Server container in
  CI. Nothing automated connects to the SmarterASP.NET database.
- **Re-check before relying on it.** These facts are only as current as their dates. A host upgrade can change the
  runtime patch or the compatibility level, so the record is re-verified before Phase 3's first deploy and before
  the Phase 17 cutover.

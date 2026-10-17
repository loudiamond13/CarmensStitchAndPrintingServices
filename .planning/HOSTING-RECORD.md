# SmarterASP.NET Hosting Record (FND-13)

*Created: 2026-10-07T11:10:20-05:00 · Updated: 2026-10-17T09:26:00-05:00*

D-28 decision: option-a (2026-10-07) - a separate, throwaway probe site next to the live site (never on top of it) plus look-only (SELECT) database queries that the owner runs in the control panel.

This file records the facts about the SmarterASP.NET hosting that CSPS depends on. The owner reads them in the
control panel, in the database query tool and from a one-time probe, then pastes the answers back. Claude fills in
the Facts table from what was pasted. The checks are run in plan 01-13. Nothing here was guessed: a fact that was not
seen stays **Unverified** (D-09).

**Results received 2026-10-07 (plan 01-13).** The owner ran sections A and B and step D1, and pasted the results.
Section C (the probe) was **not run**: the Basic plan does not let the owner create a free extra site, so no probe
site was created or deleted, and every probe fact stays Unverified. Step D2 (the Gmail "Show original" check) has not
been done yet. The account prefix of the database name is masked as `db_…_csptailoringdb`.

**Probe results received 2026-10-16 (plan 03-20, quick 261016-w4u).** The probe ran once on the CSPS site root
through the deploy workflow's `hostprobe` action: run 39000637708 (`probe_rewrite` false) and run 39000906168
(`probe_rewrite` true), both success. The facts below that name the probe come from those two runs. The site's folder
path and the address the probe saw for its caller (the GitHub runner) are not recorded.

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
| Legacy database settings | B3 (live database row) | `db_…_csptailoringdb`: compatibility_level 150, collation SQL_Latin1_General_CP1_CI_AS, is_read_committed_snapshot_on 0, recovery SIMPLE; retired 2026-10-16 (D-03), preserved only in the .bak | Verified | 2026-10-07 |
| CSPS production database | Owner query, D-18 step 3 (`SELECT @@VERSION` and the `sys.databases` row) | `db_…_cspsdb`: Microsoft SQL Server 2025 (RTM-CU3) (KB5077896) - 17.0.4025.3 (X64), Standard Edition (64-bit) on Windows Server 2022 Standard 10.0 (Build 20348) (Hypervisor); compatibility_level 170, collation SQL_Latin1_General_CP1_CI_AS | Verified | 2026-10-16 |
| SQL Server 2025 offered | Service-desk ticket (owner, 2026-10-07) | Yes: a new SQL Server 2025 database can be created in the control panel. There is no in-place upgrade; the live data moves by restoring a .bak into the new database. Not answered: extra cost, and whether the Basic plan's 1-database limit allows a second database | Verified | 2026-10-07 |
| Database allocated size | B4 | AllocatedMB 16.0 | Verified | 2026-10-07 |
| Hosting login owns the database | B5 (IsDbOwner only) | IsDbOwner 1 (the hosting login is a member of db_owner) | Verified | 2026-10-07 |
| Hosting login permissions | B6 | db_owner-level: CONTROL plus all DDL/DML (among them CONTROL, ALTER, CREATE TABLE, BACKUP DATABASE and ALTER ANY DATABASE DDL TRIGGER); the full list was provided by the owner | Verified | 2026-10-07 |
| .NET runtime patch | C probe: frameworkDescription, environmentVersion | .NET 10.0.7, 64-bit. This is below the 10.0.13 CSPS needs, so CSPS ships its own runtime (see "ASP.NET Core 10.0.13 (or newer) runtime on the host") | Verified | 2026-10-16 |
| In-process hosting | C probe: processName, inProcess; or the live legacy app's web.config (owner-pasted) | The live legacy app's web.config uses AspNetCoreModuleV2 with `hostingModel="inprocess"` (2026-10-07). The probe confirmed it: process w3wp, in-process true, 64-bit | Verified | 2026-10-16 |
| Content root vs current directory | C probe: contentRootPath, currentDirectory | The same folder (the path itself is not recorded) | Verified | 2026-10-16 |
| Logs folder writable | C probe: logsWritable | Yes. The logs folder did not exist before; the app could create it and write to it | Verified | 2026-10-16 |
| Client IP / proxy topology | C probe: remoteIpAddress, xForwardedFor, xRealIp, cfConnectingIp | No proxy: X-Forwarded-For, X-Real-IP and CF-Connecting-IP were all empty, and the app saw the caller's own address directly (not recorded) | Verified | 2026-10-16 |
| HTTPS termination | C probe: isHttps, xForwardedProto; first-deploy smoke (https-redirect, security-headers) | The app sees https itself (isHttps true) with no X-Forwarded-Proto, so TLS ends at IIS on the same server. Outside view of the live site (2026-10-07): IIS 10 with a Let's Encrypt certificate. First CSPS deploy (run 39006538697, and again from this PC on 2026-10-17): http answered 301 to https, and HSTS and the strict CSP are present | Verified | 2026-10-17 |
| Asia/Manila and en-PH available | C probe: manilaZone, enPhCulture | Both available: Asia/Manila found at +08:00, and en-PH formats money as "₱12,450.00" | Verified | 2026-10-16 |
| PFX EphemeralKeySet round trip | C probe: certificateRoundTrips (ephemeral, machine, user, ephemeral-3des) | ephemeral, user and ephemeral-3des fail at load with 0x80090024 ("The profile for the user is a temporary profile"). machine works, and its key was removed after use. CSPS now loads its certificate with MachineKeySet (quick 261016-w4u) | Verified | 2026-10-16 |
| App pool memory available | C probe: totalAvailableMemoryBytes | Not known. The probe saw about 24 GB, which is the server's memory, not the 256 MB app-pool limit, so the pool limit itself is still unseen | Unverified | - |
| IIS accepts urlCompression in the site web.config | C probe: the probe's web.config carried `<urlCompression doStaticCompression="false" doDynamicCompression="false" />` | Yes: the probe answered 200, not a 500.19 locked-section error | Verified | 2026-10-16 |
| URL Rewrite module | C probe with `probe_rewrite` true (one HttpToHttps rule in the probe's web.config) | Present: with the HttpToHttps rule, http answered 301 to https in run 39000906168 | Verified | 2026-10-16 |
| AllowedHosts set to the real host names | First-deploy smoke (host-filter), run 39006538697 and again from this PC | A request to the site with the Host header `smoke.invalid` was refused with 404, so the production settings allow only the real host names (IN-06) | Verified | 2026-10-17 |
| web.config requestLimits honoured by IIS | First-deploy smoke (request-limit), run 39006538697 and again from this PC | A 1.5 MB POST was refused by the app with 413. The smoke sends 1.5 MB on purpose, below the 2 MiB IIS backstop in web.config, so the app's own limit answers. IIS accepted the requestLimits section (the site runs, no 500.19 error); a body over 2 MiB refused by IIS itself was not tried | Verified | 2026-10-17 |
| IIS compression of JSON | First-deploy smoke (json-not-compressed), run 39006538697 and again from this PC | None: the /health JSON came back with no Content-Encoding, so IIS does not compress API responses (BREACH) | Verified | 2026-10-17 |
| Static caching through IIS | First-deploy smoke (shell-cache, hashed-asset), run 39006538697 and again from this PC | index.html is served with Cache-Control no-cache; the hashed script under /assets is immutable and served br-compressed | Verified | 2026-10-17 |
| Outbound SMTP from the site (port 587, or 465) to the SmarterASP.NET mail server | First Manager bootstrap and first sign-in (D-18 step 8, owner) | Works: the invite the bootstrap queued was sent by the live site and arrived in the owner's mailbox, and the 6-digit sign-in code email arrived too | Verified | 2026-10-17 |
| Outbound HTTPS to the breached-password service (`api.pwnedpasswords.com`) | Owner's look-only query after setting the first password: `SELECT COUNT(*) FROM AuditLog WHERE Action = 'auth.breach-check-unavailable';` | 0: the password set wrote no breach-check-unavailable audit entry, so the site reached the service | Verified | 2026-10-17 |
| `__Secure-csps_rt` cookie on the production HTTPS host | Owner, browser developer tools after the first sign-in | HttpOnly, Secure, SameSite Strict, Path /api/v1/auth | Verified | 2026-10-17 |
| `__Secure-csps_2fa` cookie on the production HTTPS host | Owner, browser developer tools during the code step | Not observed by the owner: the cookie exists only during the code step and was gone after sign-in. Its attributes (Secure, HttpOnly, SameSite Strict, Path /api/v1/auth) come from the same AuthCookies code as `__Secure-csps_rt` and are pinned by the auth integration tests (AuthRegistrationTests, SignInEndpointTests). Waiting for the owner's sign-off | Unverified | - |
| Data Protection certificate and `App:PublicBaseUrl` available to the bootstrap command on the host | Bootstrap (docs/operations/bootstrap-manager.md), run from the owner's PC against the hosted database with the site's certificate settings | Works: the command exited 0 with the invite queued; the live site decrypted the queued invite with its own key ring and sent it, and the invite link opened the live site, where the password was set | Verified | 2026-10-17 |
| The real bootstrap on the hosted database, then the first sign-in with an emailed code (AUTH-12) | D-18 step 8 (owner) | Bootstrap against `db_…_cspsdb` exited 0; invite received, password set, 6-digit code received, and the owner signed in to the admin portal on https://cspstailoring.com | Verified | 2026-10-17 |
| ASP.NET Core 10.0.13 (or newer) runtime on the host | C probe: frameworkDescription (D-35) | No: the host runtime is 10.0.7. Met instead by the self-contained win-x64 package, which carries ASP.NET Core 10.0.13 (owner, 2026-10-16) | Verified | 2026-10-16 |
| Client IP and proxy topology before the per-address limits are trusted (D-39) | C probe: the "Client IP / proxy topology" row above | No proxy, so the per-address limits key on the client's own address | Verified | 2026-10-16 |
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

**Every row has moved into the Facts table** (plans 03-20 to 03-22, 2026-10-16 and 2026-10-17):

- "ASP.NET Core 10.0.13 (or newer) runtime on the host": Verified 2026-10-16 (probe; met by the self-contained package).
- "AllowedHosts set to the real host names" and "web.config requestLimits honoured by IIS": Verified 2026-10-17 (first-deploy smoke).
- "Outbound SMTP from the site", "Outbound HTTPS to the breached-password service", "Data Protection certificate and
  `App:PublicBaseUrl` available to the bootstrap command on the host" and "The real bootstrap on the hosted database,
  then the first sign-in with an emailed code (AUTH-12)": Verified 2026-10-17 (D-18 step 8, owner).
- "Set-Cookie for `__Secure-csps_rt` and `__Secure-csps_2fa`" became two Facts rows: `__Secure-csps_rt` Verified
  2026-10-17; `__Secure-csps_2fa` Unverified (not observed by the owner, attributes pinned by tests), waiting for the
  owner's sign-off.

## Consequences for later phases

- **CSPS is live (owner, 2026-10-17).** The legacy site and database are retired (D-01, D-03) and kept only as the
  .bak and the site-files zip. There is no staging site (D-11). CSPS has served the live site since the first deploy
  on 2026-10-17 (run 39006538697, release `deploy-20261017053115-bd34a88`), the first Manager signed in the same day,
  and the owner accepted CSPS live on 2026-10-17. From now on a rollback means redeploying an earlier CSPS release
  (D-05), never the legacy site.
- **Database version target (D-33, owner, 2026-10-07).** The host runs SQL Server 2022 today, but the owner's
  target production database is **SQL Server 2025**. The owner plans to retire the current SQL Server 2022 database
  hosting and restore the live data onto a SQL Server 2025 database. Notes for that move:
  - **Done 2026-10-16 (Phase 3 cutover, D-18 step 3):** the SQL Server 2025 database now exists (`db_…_cspsdb`,
    17.0.4025.3, compatibility level 170) and is empty; CSPS builds its schema from migrations. The legacy database
    was deleted from the host and lives only in the .bak until the Phase 16 import. `SqlCompatibility.Level` is 170.
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
- **Compatibility level (D-13, D-33).** *Superseded 2026-10-16: re-pinned to 170 for the SQL Server 2025 database
  (plan 03-19, see "Database version target" above).* `SqlCompatibility.Level` stays at **160, provisional**. It is not re-pinned
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
- **Probe facts (Phase 3, 2026-10-16).** The probe ran on the CSPS site root (runs 39000637708 and 39000906168).
  Verified: runtime 10.0.7 (too old, so the package is self-contained), in-process 64-bit hosting, content root equals
  the current directory, a writable logs folder, no proxy, TLS ending at IIS, Asia/Manila and en-PH, the machine key
  store as the only working certificate load, IIS accepting urlCompression, and the URL Rewrite module. Only the
  app-pool memory limit is still unseen.
- **HTTPS rewrite (OPS-05, owner ruling 2026-10-16): IIS rule.** The site web.config redirects http to https with the
  HttpToHttps rule before the app runs; the app keeps its own redirect and HSTS. It ships on the phase branch (quick
  261016-w4u) in the Phase 3 follow-up PR and goes live with the first deploy after that merge. If the host ever drops
  URL Rewrite, every page fails with 500.19 until the rule is removed. Live since the first deploy (PR #6, run
  39006538697, 2026-10-17): http answers 301 to https.
- **Runtime (owner, 2026-10-16): self-contained win-x64.** The host runtime is 10.0.7, so the CI package carries its
  own .NET and ASP.NET Core runtime (10.0.13 at the time of writing) and IIS starts `Csps.Server.exe` from the site
  folder. The package grows from about 34 MB (14 MB zipped) to about 139 MB (60 MB zipped). It needs the 64-bit app
  pool the probe saw.
- **Data Protection certificate (2026-10-16): MachineKeySet.** It is the only load the host allows. The key file lives
  in the host's machine key store only while the app runs and is removed on a graceful shutdown or recycle. A crash or
  a killed process can leave one file behind in the host's machine key store.
- **Forwarded headers.** No proxy was seen (2026-10-16), so forwarded-headers handling stays off and the API keeps
  ignoring `X-Forwarded-For` and similar headers (ForwardedHeadersTests).
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

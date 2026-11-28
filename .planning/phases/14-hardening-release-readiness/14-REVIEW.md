---
phase: 14-hardening-release-readiness
created: 2026-11-28T01:23:54-06:00
updated: 2026-11-28T01:23:54-06:00
reviewed: 2026-11-28T07:30:00Z
depth: standard
scope: wave 1 (plans 14-01 to 14-09 and 14-11), diff base fc1064c8
files_reviewed: 62
files_reviewed_list:
  - Csps.slnx
  - docs/dependencies.json
  - docs/operations/a11y-manual-passes.md
  - docs/operations/backup-restore.md
  - docs/operations/breach-response.md
  - docs/operations/break-glass-mail.md
  - docs/operations/data-requests.md
  - docs/operations/install-staff-app.md
  - docs/operations/lockout.md
  - docs/operations/security-review.md
  - src/Csps.Domain/Analytics/AnalyticsBots.cs
  - src/Csps.Server/Endpoints/PublicHeadWriter.cs
  - src/Csps.Server/Endpoints/ShellPage.cs
  - src/Csps.Server/web.config
  - tests/Csps.ArchitectureTests/A11yManualRecordTests.cs
  - tests/Csps.ArchitectureTests/NoUnsafeCodeTests.cs
  - tests/Csps.ArchitectureTests/OperationsRunbookTests.cs
  - tests/Csps.ArchitectureTests/RestoreDrillScriptTests.cs
  - tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs
  - tests/Csps.ArchitectureTests/SolutionLayoutTests.cs
  - tests/Csps.CiMailbox.Tests/CiMailboxTargetGuardTests.cs
  - tests/Csps.CiMailbox.Tests/Csps.CiMailbox.Tests.csproj
  - tests/Csps.CiMailbox.Tests/OutboxReaderTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/AnalyticsBotsTests.cs
  - tests/Csps.Server.IntegrationTests/Http/SecurityHeadersTests.cs
  - tests/Csps.Server.IntegrationTests/Http/ShellPageTests.cs
  - tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs
  - tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs
  - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyProbeController.cs
  - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs
  - tests/Csps.Testing/Fixtures/webroot/manifest.webmanifest
  - tools/Csps.CiMailbox/CiMailboxTargetGuard.cs
  - tools/Csps.CiMailbox/Csps.CiMailbox.csproj
  - tools/Csps.CiMailbox/OutboxReader.cs
  - tools/Csps.CiMailbox/Program.cs
  - tools/scripts/Restore-BackupDrill.ps1
  - web/e2e/deleteOrderDialog.ts
  - web/e2e/motion.spec.ts
  - web/public/manifest.webmanifest
  - web/scripts/design-side-by-side.mjs
  - web/scripts/design-side-by-side.test.ts
  - web/scripts/pwa-icons.mjs
  - web/scripts/pwa-icons.test.ts
  - web/src/components/actions/UiLink.tsx
  - web/src/components/actions/links.test.tsx
  - web/src/components/navigation/Sidebar.test.tsx
  - web/src/components/navigation/Sidebar.tsx
  - web/src/components/navigation/SiteHeader.test.tsx
  - web/src/components/navigation/SiteHeader.tsx
  - web/src/core/routes/router.tsx
  - web/src/core/routes/viewTransitionGuard.test.ts
  - web/src/core/routes/viewTransitionGuard.ts
  - web/src/hooks/usePrefersReducedMotion.test.ts
  - web/src/hooks/usePrefersReducedMotion.ts
  - web/src/layouts/AdminLayout.test.tsx
  - web/src/layouts/AdminLayout.tsx
  - web/src/modules/public/legalPrivacy.ts
  - web/src/test/viewTransitionSpy.tsx
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 14: Code Review Report (wave 1)

*Created: 2026-11-28T01:23:54-06:00 · Updated: 2026-11-28T01:23:54-06:00*

**Reviewed:** 2026-11-28
**Depth:** standard
**Files reviewed:** 62 (the listed source files; lock files and PNGs skipped)
**Status:** issues_found

## Summary

I read every listed file and compared the diff with the owner rulings D-36, D-40 and D-48, and with the project rules.

The two safety guards the brief named both hold up:

- **CI mailbox tool (D-36).** `CiMailboxTargetGuard` allows exactly one target. It needs `GITHUB_ACTIONS` to equal `true`, a host of `127.0.0.1` or `localhost` with a numeric port, and the database `CSPS_Zap`. `AttachDBFilename` and `Failover Partner` are refused. It uses the same `SqlConnectionStringBuilder` parser as the real connection, so duplicate keys cannot hide a second database. The guard runs before any connection opens. The connection string comes only from the environment, and the in-memory configuration entry is added last, so an environment variable cannot override it. The refusal text never repeats the connection string. I found no bypass.
- **Restore drill (D-40).** The server and database are fixed in the script, and the only `DROP DATABASE` names `[CSPS_RestoreDrill]`. The `.bak` must sit under `_local`, must end in `.bak`, and must not be a link. `RESTORE FILELISTONLY` and `RESTORE VERIFYONLY` run before any drop. The receipt reads catalog views plus the latest migration id only. All SQL values go in as parameters or are quoted with `N'..'`.

The page-fade guard (D-48) matches the ruling. Back and Forward and reduced motion run the update at once. The `subscribe` order puts the guard's listener ahead of the router provider's, so `action` is current when `startViewTransition` runs. The drawer links, the same-page links and the non-Chromium browsers get no fade.

I found no secrets, real names, emails or `C:/Users/...` paths in the tracked files. There is no em or en dash in any changed file. No SQL trigger was added. The CSP is unchanged.

There are no blockers. The warnings are one failure path in the drill script, three test or doc claims that are weaker than they say, and one shallow link check.

## Warnings

### WR-01: Restore drill dies without a receipt when the backup has no migration history table

**File:** `tools/scripts/Restore-BackupDrill.ps1:335-342`
**Issue:** The migration query reads `[CSPS_RestoreDrill].[dbo].[__EFMigrationsHistory]` with no error handling. `$ErrorActionPreference` is `Stop`.

Failure scenario: the owner points the drill at a `.bak` of the old legacy database, or a hosting backup of an empty database. `RESTORE` and `CHECKDB` succeed, then `ExecuteScalar()` throws "Invalid object name". The script ends with a raw terminating error. No receipt is written, so the Match and Mismatch lines the runbook tells the owner to read do not exist. The restored copy stays on the instance, holding real data.

The same shape applies to the catalog query: any exception between the restore and the receipt leaves a restored copy and no record.

**Fix:** Catch the failure around the migration read and record it in the receipt.

```powershell
try {
    $latest = $migration.ExecuteScalar()
    if ($null -ne $latest -and -not ($latest -is [System.DBNull])) { $latestMigration = [string]$latest }
}
catch {
    $latestMigration = $null   # the receipt already prints 'No migration found' and marks a given ExpectedMigration as Mismatch
}
```

Wrap the rest of the post-restore block the same way, so the receipt and exit code 3 still happen.

### WR-02: The "no links" check looks only at the file and the `_local` folder, not folders between them

**File:** `tools/scripts/Restore-BackupDrill.ps1:120-134`
**Issue:** The script says a link inside `_local` could point anywhere, so it refuses links. It checks the `.bak` file and `_local` itself. It does not check a subfolder in between.

Failure scenario: `_local\old` is a junction to a folder outside the project. `_local\old\x.bak` passes the `StartsWith(_local\)` test and the reparse check on the file, because the file itself is not a link. The drill then reads a file from outside `_local`. The impact is small because the owner runs it by hand, but D-40 says "only `_local/` backups", and a test pins this claim.

**Fix:** Walk every parent between `$full` and `$localRoot` and refuse if any has the `ReparsePoint` attribute.

```powershell
$dir = Split-Path -Parent $full
while ($dir.Length -ge $localRoot.Length) {
    if ((Get-Item -LiteralPath $dir -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        Stop-Script 'Refusing to run: no folder on the way to the .bak may be a link.'
    }
    $dir = Split-Path -Parent $dir
}
```

### WR-03: The AllowUnsafeBlocks scan misses the attribute form and a trailing-comment form

**File:** `tests/Csps.ArchitectureTests/NoUnsafeCodeTests.cs:269`
**Issue:** The regex needs the literal text `<AllowUnsafeBlocks>`. A project that writes `<AllowUnsafeBlocks Condition="'$(Configuration)' == 'Release'">true</AllowUnsafeBlocks>` is not matched. A line that starts with a comment close and then holds the setting, such as `<!-- note --> <AllowUnsafeBlocks>true</AllowUnsafeBlocks>`, is skipped by the `^(?!\s*<!--)` look-ahead. `security-review.md` cites this test as the proof for seven memory-safety rows, so a quiet miss weakens SEC-05. The sample tests only cover the plain form.

**Fix:** Allow attributes, and strip XML comments before matching:

```csharp
[GeneratedRegex(@"<AllowUnsafeBlocks(\s[^>]*)?>\s*true\s*</AllowUnsafeBlocks>", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
```

```csharp
var withoutComments = Regex.Replace(File.ReadAllText(file), @"<!--.*?-->", string.Empty, RegexOptions.Singleline);
```

Add an InlineData row for the conditional form.

### WR-04: The outbound-call scan is narrower than the CWE-918 row that cites it

**File:** `tests/Csps.ArchitectureTests/NoUnsafeCodeTests.cs:44-51` and `docs/operations/security-review.md:35`
**Issue:** `OutboundTokens` lists `HttpClient`, `IHttpClientFactory`, `HttpRequestMessage`, `WebClient`, `WebRequest` and `TcpClient`. The review row says "a scan limits which files may make them" and "Outbound calls go only to fixed hosts (Cloudinary and the breached-password range lookup)".

Two gaps:

- **Missing types.** A new file using `SocketsHttpHandler`, `HttpMessageHandler`, `Socket`, `UdpClient`, `Dns.GetHostEntry` or `RestClient` passes the scan.
- **Inaccurate row.** The app also connects out to the SMTP host, through MailKit. That is a fixed host from settings, but the row does not name it. The reader of the review is told the list is complete.

**Fix:** Add `Socket`, `SocketsHttpHandler`, `HttpMessageHandler`, `UdpClient`, `Dns.` and `MailKit.Net` to the token list, and allow-list the SMTP sender file. Add "the mail host from settings" to the CWE-918 row.

### WR-05: `a11y-manual-passes.md` warns about the wrong lock rule for wrong codes

**File:** `docs/operations/a11y-manual-passes.md` (the line "Be careful with the sign-in code (flow 1). Too many wrong codes pause sign-in for 15 minutes. Use one wrong code, once.")
**Issue:** `audit-log.md` and `security-review.md` (row T1621) say the account locks on the tenth wrong code in an hour. Each emailed code also has its own limit, and then the screen says "This code can't be used anymore". The record gives no number, and "pause for 15 minutes" does not match the tenth-code rule or the `auth.lockout` entry. `lockout.md` says the same 15 minutes for codes. If the 15-minute figure is only the password lockout, the owner may fear a lock that is not there. If the code lock is different, two runbooks are wrong.

I checked `AuthSettings.CodeLifetime` (15 minutes) and `IdentityRegistration` (5 wrong passwords, 15 minutes). I did not find the code-lockout length in the code I read.

**Fix:** Read the code-lockout setting in `AuthSettings`, then make `lockout.md`, `a11y-manual-passes.md` and `audit-log.md` all state the same count and length.

## Info

### IN-01: `measureRegion` and `settleRegion` repeat the same region lookup

**File:** `web/e2e/deleteOrderDialog.ts:42-57` and `web/e2e/deleteOrderDialog.ts:59-75`
**Issue:** Both functions hold the same eight-line search for the Overlay region. Each is serialised into the page on its own, so they cannot call a shared helper from the file scope. A later change to one will drift from the other. The move to `evaluate(fn, arg)` itself is right and removes the CodeQL `js/bad-code-sanitization` alert.
**Fix:** Have one page function take a mode argument, or build the shared lookup as one `evaluate` that returns both the animations wait and the metrics.

### IN-02: Restore drill receipt row counts come from `sys.partitions`

**File:** `tools/scripts/Restore-BackupDrill.ps1:312`
**Issue:** `sys.partitions.rows` is documented as an approximate count. On a fresh restore it is normally exact, but the drill turns it into a hard Match or Mismatch against the owner's counts.
**Fix:** Keep it (it avoids reading user rows), and add one line to the runbook: a Mismatch of a few rows after a clean `CHECKDB` should be confirmed in the admin before it is treated as data loss. Or use `sys.dm_db_partition_stats.row_count`, which is exact.

### IN-03: A `CHECKDB` error of any kind is recorded as "Failed"

**File:** `tools/scripts/Restore-BackupDrill.ps1:287-294`
**Issue:** The catch is empty of detail. A lost connection and real corruption look the same in the receipt, and the message is thrown away.
**Fix:** Keep the exception text (it has no table data) in a variable and print it to the console, not to the receipt.

### IN-04: The invite-token pattern can take trailing punctuation

**File:** `tools/Csps.CiMailbox/OutboxReader.cs:69`
**Issue:** `#token=(?<value>[^\s]+)` ends only at whitespace. If the renderer ever wraps the link as `(https://.../accept-invite#token=abc)` or ends a sentence with it, the printed token holds a `)` or `.`. The CI script would then post a bad token, and the ZAP sign-in step would fail with an unhelpful error. Today's text puts the link at the end of a line, so it works.
**Fix:** Restrict the value to the token alphabet the app issues, for example `[A-Za-z0-9_%\-.~]+` minus a trailing `.`, and add a test for a wrapped link.

### IN-05: `GITHUB_ACTIONS` is a soft gate

**File:** `tools/Csps.CiMailbox/CiMailboxTargetGuard.cs:31`
**Issue:** Anyone can set `GITHUB_ACTIONS=true` on their own PC. The real protection is the loopback host plus the `CSPS_Zap` name, which the guard also enforces, so this is not a hole. The doc comment says the tool "runs only inside GitHub Actions", which a reader may trust too much. A port-forward to loopback on a developer PC would pass the guard if it forwarded to a database named `CSPS_Zap`.
**Fix:** Say in the doc comment that the host and database checks are the real gate, and that `GITHUB_ACTIONS` is a guard against mistakes only.

### IN-06: `guardViewTransitions` wraps `document.startViewTransition` again on every hot reload

**File:** `web/src/core/routes/viewTransitionGuard.ts:13-31` and `web/src/core/routes/router.tsx:174`
**Issue:** The call sits at module level. When Vite hot-reloads `router.tsx` in development, the module runs again and wraps the previous wrapper. Each old wrapper keeps its own `action` variable, subscribed to the old router. This can leave an old wrapper returning the instant fake after a Back, and the effect piles up through a long dev session. It does not touch production.
**Fix:** Mark the wrapped function (for example a symbol property) and return early when it is already guarded, or call the guard from `main.tsx` once.

---

_Reviewed: 2026-11-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

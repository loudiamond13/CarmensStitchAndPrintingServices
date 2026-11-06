# Owner items parked during the Phase 9 review and ship

*Created: 2026-11-06T01:10:00-06:00 · Updated: 2026-11-06T01:23:00-06:00*

The owner was away while the second Phase 9 code review, verify, validate, secure and PR steps ran (2026-11-05 to 2026-11-06). Anything that needed the owner was parked here instead of blocking the run. Nothing here was decided for the owner.

## P9-BL-01 · Limit the maintenance key to the main branch (WR-R2-01)

**Status:** open · **Blocks:** nothing in code.

The Maintenance workflow checks the branch before it calls the site, but that check only stops an accidental run. Anyone who can push a branch can change the workflow file, and the key is a repository secret, so a changed workflow can still read it. The real guard is a GitHub environment that only main can use.

- **A (recommended):** in GitHub Settings, Environments, create `maintenance` with "Deployment branches: main only", move `MAINTENANCE_KEY` into it and delete the repository secret. Then add `environment: maintenance` to the job in `.github/workflows/maintenance.yml` (one line, a follow-up PR).
- **B:** keep it as it is. The docs now say the guard only stops accidental runs.

## P9-BL-02 · Confirm the 10 minute maintenance lease (WR-G1B-02)

**Status:** open. A run holds the maintenance lease for 10 minutes, so a run that crashes blocks the next one for up to 10 minutes. Recommended: keep 10 minutes, since jobs run hourly at most.

## P9-BL-03 · Wording of the 100 MP photo refusal (D-53)

**Status:** open. A photo that is still over the size limit after shrinking gets the same message as the 25 MP limit. Recommended: keep the current text; it already tells staff to use a smaller photo.

## P9-BL-04 · Real-photo GPS check (UAT 19)

**Status:** open, manual. Upload a real Android JPEG and an iPhone HEIC that have a location, download the stored copy and confirm the location is gone (for example with an online EXIF viewer).

## P9-BL-05 · Run now from GitHub (UAT 20)

**Status:** open, after merge and deploy. On GitHub, Actions, Maintenance, "Run workflow" on main, then check that the run is green and the site log shows the jobs.

## P9-BL-06 · Owner sign-off on 09-SECURITY.md

**Status:** open. 0 open threats, 5 accepted risks (AR-09-01 to AR-09-05). The accepted risks need the owner's yes.

## P9-BL-07 · Harden the photo metadata strip for unusual files (IN-G1A-02)

**Status:** open, info level. Rare APP0 extras in JPEGs and unknown WebP chunks are passed through as they are. Recommended: a small hardening plan in a later phase.

## P9-BL-08 · Test flakes seen during the runs

**Status:** recorded, no action needed unless they come back.

- `ExpenseListTimingTests` p95 was 331 ms against 300 ms on a busy machine. It passed when run alone, and no expense code changed.
- `license-policy.test.ts` ("exits 1 on a stricter policy given through --exceptions") fails only in the `.claude/worktrees/p09` folder with "No packages found in this path". The same files pass in the main folder. CI on the PR is the check.
- The e2e run in the worktree had 32 failures in WebKit, iPhone and Firefox (none in photo tests). Re-run alone, 15 passed; the 17 left are P9-BL-10.

## P9-BL-10 · The showcase page is too slow for WebKit and iPhone tests

**Status:** open · **Blocks:** nothing in CI (CI runs Chromium and the phone viewport only).

17 tests in WebKit and iPhone open `/dev/components` and wait 5 seconds for its heading, which does not appear in time. They still fail when run alone. Plan 09-30 found the cause: the page grew with the Order photos cases, and the same tests passed with that section switched off.

- **A (recommended):** move the Order photos cases to their own dev page (for example `/dev/photos`), so the showcase is back to its earlier size. This needs a small plan, because the build rule D-33 says only the showcase page's own chunk may hold showcase modules, and a new dev page adds one.
- **B:** give those tests a longer heading wait in WebKit only. Quick, but it hides a slow page instead of fixing it.
- **C:** leave it. The tests stay red in local full runs only.

## P9-BL-09 · Merge the Phase 9 PR

**Status:** open, owner only. Merge only through `tools/scripts/Merge-PullRequest.ps1` when the owner says so.

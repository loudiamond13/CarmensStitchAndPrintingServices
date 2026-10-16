# Runbook: deploy the site to production

*Created: 2026-10-16T01:38:00-05:00 · Updated: 2026-10-16T16:50:00-05:00*

CSPS goes live only when you press Run on the **Deploy** workflow (OPS-04, D-11). Pressing Run is the approval. A merge to `main` never deploys by itself, and the workflow refuses to run from any other branch.

A deploy takes a build that already passed CI and does this, in order:

1. Puts a branded "back in a minute" page on the site (`app_offline.htm`) and waits 5 seconds, so visitors see that page instead of an error.
2. Copies the new files to the host with Web Deploy, deleting files that no longer belong.
3. Takes the "back in a minute" page down.
4. Runs the smoke test against the live site.
5. If the smoke test passes, records a release named `deploy-<date and time>-<first 7 characters of the sha>`. That release keeps the package, so it can be put back later.

If step 2 or 4 fails, the workflow rolls back by itself (see "What the automatic rollback does").

## How to deploy

1. Find the commit to deploy: the newest commit on `main` whose CI run is green. On GitHub, open Actions, then CI, and pick the latest green run for the `main` branch. Copy its full 40-character commit sha.
2. Open Actions, then **Deploy**, then **Run workflow**.
3. Keep the branch on `main`. Set **action** to `deploy`, paste the sha, leave **dry_run** off, and press **Run workflow**.

The same from a terminal:

```powershell
gh workflow run deploy.yml --ref main -f action=deploy -f sha=<the 40-character sha>
```

Open the run to watch it. When it ends, the run summary shows a table with one row per step and, on success, the name of the release. A red run means something failed. The summary says what the workflow already did about it (rolled back, or left the "back in a minute" page up).

The sha must be 40 lowercase letters and digits. The workflow refuses anything else. It also refuses a sha whose CI run on `main` did not pass.

## Dry run first

Before a real deploy, and especially before the first one, run it with **dry_run** switched on:

```powershell
gh workflow run deploy.yml --ref main -f action=deploy -f sha=<sha> -f dry_run=true
```

A dry run only reads. It finds the package, checks the Web Deploy login, reaches port 8172 on the host, and, if `WEBDEPLOY_CERT_SHA256` is set, checks the host certificate. It then asks Web Deploy what it *would* change and prints the list. It puts no "back in a minute" page up, changes nothing on the site, and creates no release.

A dry run does not prove the new version starts on the host. Only a real deploy and its smoke test show that.

## What the automatic rollback does

If the file copy or the smoke test fails, the workflow puts the last good release back on its own (D-13): the "back in a minute" page goes up, the files of that release are copied, the page comes down, and the smoke test runs again. The run still ends red, so you are told, and the summary names the release it went back to.

If the rollback fails too, the "back in a minute" page stays up on purpose. Use "Recover with the online action" once the cause is fixed, or the manual rollback below.

## Roll back by hand

To go back to an older version yourself, deploy its sha again:

1. Find the sha you want. The releases page lists every good deploy as `deploy-<date and time>-<sha7>`, and each release says which commit it holds.
2. Run the Deploy workflow with action `deploy` and that sha (see "How to deploy").

Where the package comes from:

- For 14 days after a merge, from the CI run's stored package.
- After that, from the `deploy-*` release for that sha, which keeps the package for good.
- If neither exists, the workflow stops and says so. Nothing is changed.

A rollback is a normal deploy, so it also shows the "back in a minute" page and runs the smoke test. Read "Migrations before a deploy" first when the version you left behind changed the database.

## Recover with the online action

If the run summary says `app_offline.htm may still be on the site`, or visitors still see "back in a minute" after a failed run, take the page down:

```powershell
gh workflow run deploy.yml --ref main -f action=online
```

The **online** action needs no sha. It only deletes `app_offline.htm`. It does not copy files or run the smoke test, so check the site yourself afterwards. With **dry_run** on, it only asks Web Deploy what it would delete and changes nothing.

## The first deploy

The first deploy has no earlier release to go back to. That changes what a failure does:

- If the copy or the smoke test fails, the workflow does not roll back. It puts the "back in a minute" page back up and stops. The run summary says that no earlier release exists.
- You then fix the cause and run the deploy again, or use the legacy rollback kit below.

Before the first deploy:

1. Do a dry run (see above).
2. Make sure the secrets and the variable below are set.
3. Have the legacy rollback kit ready.
4. Apply the migration script (see "Migrations before a deploy"). The site never migrates its own database.
5. Optional: the one-time host check (action `hostprobe`) answers questions about the host, such as whether it accepts the compression setting CSPS ships. It needs the `HOSTPROBE_KEY` secret and may be used only once, after the legacy site is retired and before the first CSPS deploy. Its rules are in `tools/Csps.HostProbe/README.md`. The next deploy removes the probe. The workflow enforces the "once": it refuses the `hostprobe` action as soon as any `deploy-*` release exists, because the probe would replace the live site. There is no override; after the first deploy, use the `deploy` action.

## The legacy rollback kit (D-05)

CSPS replaces the legacy site on the live host (D-01). Before the first deploy, download the legacy site's files and a fresh database backup (the `.bak`) from the host, as set out in D-04 and D-05. If CSPS will not start on the host, the legacy site can be put back the same day: copy its files back and restore the `.bak` into a new database. Once you have accepted CSPS as live, "rolling back" means deploying an earlier CSPS version, not the legacy kit.

Keep the kit outside the repository. The backup holds production data and must never be committed, uploaded to GitHub or shared.

## Secrets and variables

Set these under Settings, then Secrets and variables, then Actions, on the repository. Only the names are written here. Never paste a value into the repository, an issue, a pull request or a chat.

| Name | Kind | What it is |
|---|---|---|
| `WEBDEPLOY_SERVER` | Secret | The host name of the Web Deploy endpoint, with no `https://` and no port |
| `WEBDEPLOY_SITE` | Secret | The site name as the host calls it |
| `WEBDEPLOY_USERNAME` | Secret | The Web Deploy user name |
| `WEBDEPLOY_PASSWORD` | Secret | The Web Deploy password |
| `WEBDEPLOY_CERT_SHA256` | Secret, optional | The SHA-256 fingerprint of the host's certificate. When set, a mismatch stops the deploy before anything changes. It is not full protection (see below). |
| `HOSTPROBE_KEY` | Secret, optional | At least 32 characters, only for the one-time `hostprobe` action |
| `SITE_ORIGIN` | Variable | The public address of the site, for example `https://cspstailoring.com`, used by the smoke test |

The Web Deploy password must not contain a comma, a quote (single or double), a semicolon, a space or any control character. Web Deploy reads those characters as part of its own command line, so the workflow refuses such a password and does not print it. If the host gives you one with those characters, ask for a new one.

If the host renews its certificate and you use `WEBDEPLOY_CERT_SHA256`, update the secret, or the next deploy stops with a certificate mismatch.

**What the certificate pin does not do.** The pin is checked on one separate connection. When it matches, Web Deploy is told to skip its own certificate check (`-allowUntrusted`) and sends the deploy password on its own connections. Someone who sits on the network path could pass the check and then intercept those later connections. So the pin catches a wrong or renewed certificate, but it is not proof that the password goes only to the real host. Leave `WEBDEPLOY_CERT_SHA256` unset once the host's certificate is trusted by Windows, so the check is Web Deploy's own. Making Web Deploy validate the pinned certificate itself depends on host facts that are not verified yet, so it is not built.

## Migrations before a deploy

The site never changes its own database when it starts. A build that adds a migration needs the matching change applied first:

1. Take the reviewed, idempotent script `csps-migrations.sql` from the package of the build you are about to deploy.
2. Apply it to the production database. It is safe to run more than once.
3. Then run the deploy.

Going the other way, an older version running over a newer database works only when the migration that was added is backward compatible (for example, a new nullable column). If it is not, a rollback of the app alone will fail its smoke test. Plan such a rollback with the developer before pressing Run.

## Who can deploy

Only you. The workflow starts only from the Run button or `gh workflow run`, and its job runs only on `main`. Claude starts it only when you say so in so many words.

The deploy credentials are repository secrets, so any workflow file pushed to the repository could in principle read them. (The repository was private when this was written, and a private repository on GitHub Free has no environment secrets or required reviewers. Since it became public on 2026-10-16, both are available for free: an environment can hold the secrets and name you as a required reviewer. Nothing has been created yet; that is a separate change for you to approve.) This risk is accepted (T-03-50): you are the only person who can write to the repository, `.github/` is covered by CODEOWNERS, and the deploy job gets the smallest token it can work with (`contents: write` to create the release, `actions: read` to find the package). Revisit this if another person ever gets write access.

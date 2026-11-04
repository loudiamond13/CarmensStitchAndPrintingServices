# Maintenance run: what it does, the key and how to rotate it

*Created: 2026-11-03T12:20:00-06:00 · Updated: 2026-11-04T01:05:00-06:00*

The maintenance run is one web call that cleans up the database and the photo storage (JOB-01, D-21). The GitHub
Actions workflow `.github/workflows/maintenance.yml` makes the call once a month. That workflow also has a manual "Run now" button. Nobody else uses it, and
it is not part of the public API description.

The call is protected by a secret key. This page says where the key lives and how to change it. It never shows a key,
and no example here looks like one.

## What one run does

One run does every job once, in this order. The number is the job's place in the order.

| Order | Job | What it reports |
|---|---|---|
| 10 | Purge of expired records | One count per purge rule (see the table below) |
| 20 | Stray file sweep | How many stray files it queued for removal |
| 30 | Photo removals | How many photos it removed from storage, and how many are still failing |
| 40 | Usage report | Storage and credit use against the free plan |

Later plans add their jobs to this table. Jobs with a lower number run first.

## What the purge removes

The purge job runs six rules in this order. Each rule has a safety margin, so nothing that a current rule still reads is
removed. A row exactly at the cut-off stays. Each rule deletes 500 rows at a time and stops when the 90 second budget is
spent (the answer then says `more`). If one rule fails on a database error, only its line is marked failed and the other
rules still run.

| Rule | Report line | Removed when | Why the margin |
|---|---|---|---|
| Request keys | Expired request keys removed | Their own expiry has passed | An expired key is already ignored |
| Short-lived claims (locks) | Expired request keys removed | Their own expiry has passed | An expired claim is already ignored. Standing locks are never removed |
| Sessions (their refresh tokens go with them) | Expired sign-in tokens removed | The session's fixed end was more than 1 day ago | A session past its end can never be used. Used refresh tokens of a live session stay, because reuse detection needs them |
| 2FA challenges (their codes go with them) | Expired 2FA codes removed | The challenge expired more than 1 day ago | The send and failure limits look back 1 hour |
| Account links (invite and reset) | Expired account links removed | The link expired more than 7 days ago | Keeps the "already used" and "expired" messages accurate for a week |
| Emails in the outbox | Old sent emails removed | The row was sent, failed or expired more than 30 days ago | The rule in `docs/operations/mail-setup.md`. Rows still waiting to send are never removed |

The request keys and the claims share one line, so five lines come back in all. The 30 day email rule is the owner's
(D-35). The 7 day account-link margin is open for the owner to review.

Each run has a time budget of 90 seconds. A job that runs out of time stops cleanly and says there is more to do.

## What the photo jobs do

Deleting a photo, or deleting an order for good, never calls Cloudinary while staff wait. It adds a row to a removal queue
in the database. Two jobs in the monthly run look after the files (JOB-02). Both only touch this site's own orders folder
(for example `csps/orders/` on the live site, with the trailing slash, so `csps` never matches another environment's
folder).

| Job | What it does |
|---|---|
| Stray file sweep (20) | Lists the orders folder, 500 files at a time. A file is **kept** when a photo row names it (this includes photos of orders that are only soft-deleted, because those orders can be restored), when it is already in the removal queue, or when it is less than 2 days old (an upload may still be saving). Every other file is queued as a stray |
| Photo removals (30) | Takes up to 25 due queue rows at a time and holds each for 5 minutes, so two runs never work on the same row. It asks Cloudinary to remove the file and its cached copies, then deletes the row. A file Cloudinary no longer has counts as removed. When Cloudinary is busy it tries again up to 3 times in all, after 2 and then 8 seconds. A row that still fails stays in the queue with one more attempt and its failure code, and the next run tries it again |

The sweep runs first, so the strays it queues are removed in the same run. A queued file that a photo row still names is
**never** removed: the job drops only the queue row. That can happen when an upload's reply was lost after the photo was
saved. A file outside the site's own orders folder is never removed either.

Each job stops when the 90 second budget is spent and says there is more. The next call carries on from the database.
The sweep starts its listing again from the first page, but files it already queued are skipped.

### The photo lines and what to do

| Line | Red? | What it means | What to do |
|---|---|---|---|
| Photos removed from storage: n | No | n files were removed (or were already gone) | Nothing |
| Stray files removed (older than 2 days): n | No | n stray files were queued. The removal job removes them in the same run | Nothing. A large number the first time is normal |
| Queued removals dropped (photo still in use): n | No | n queue rows named a file that a photo still uses. The files were kept | Nothing. It is rare |
| Photo removals still failing: n | Yes | n removals failed 3 tries, or named a file outside the site's own folder. The rows stay queued | The host log has one line per failure, "A queued photo removal failed", with the row number and a code (`transient` means Cloudinary was busy, `refused` means it said no, `outside-folder` means the file is not in this site's folder). Press Run now later. If it keeps failing, check the Cloudinary account |
| Cloudinary refused the keys. Check the Cloudinary settings. | Yes | Cloudinary did not accept the cloud name, key or secret. The job stopped and left every row for the next run | Check the three `Cloudinary__...` values on the host against the Cloudinary dashboard (see `cloudinary-setup.md`), then press Run now |
| The stray file sweep could not read the photo storage. | Yes | The listing failed, for example because Cloudinary was busy or the keys are wrong | Press Run now later. If it repeats, check the keys as above |
| Photo removals not run, or Stray file sweep not run (photo storage is not set up.) | No | The host has no Cloudinary keys, so there is nothing to do | Nothing, unless photos should be working. Then set the keys |

Nothing is lost when a line is red. The rows stay queued, and no file is removed until Cloudinary answers.

## The monthly schedule and Run now

The workflow is called **Maintenance** (job `monthly maintenance`). It has two triggers and no others.

| Trigger | When | Notes |
|---|---|---|
| Schedule | Cron `17 19 1 * *`: 19:17 UTC on the 1st of each month, which is 03:17 on the 2nd in Manila | The minute is off the top of the hour, when GitHub is busiest |
| Run now | Whenever the owner presses it | Actions tab, **Maintenance**, **Run workflow**, or `gh workflow run maintenance.yml --ref main` |

Pressing Run now twice does not run two calls together. The second waits for the first (the workflow's `maintenance` queue), and a running call is never cancelled.

### What the workflow needs in GitHub

Both are set once by the owner, in the GitHub repository under Settings, Secrets and variables, Actions:

1. The repository **secret** `MAINTENANCE_KEY`. It holds the same value as the host's `Maintenance__Key` (see "The key" below). Paste it from the password manager. Never type it into a chat, a commit or an issue.
2. The repository **variable** `SITE_ORIGIN`. The Deploy workflow already uses it. It must be the live site's `https` address with no path, for example `https://example.test`. The script refuses anything else before it sends the key.

The workflow uses a repository secret, not the `production` environment. An environment with a required reviewer would hold every monthly run until someone approved it.

### What the workflow does

`web/scripts/maintenance.mjs` posts to `{SITE_ORIGIN}/api/v1/maintenance/run` with the key in the `X-Maintenance-Key` header.

- When the answer says `more`, it calls again, up to 10 calls in all. If there is still more after 10 calls, the run turns red.
- When the site answers 409 (another run is going), it waits 60 seconds and tries again, up to 4 retries.
- It follows no redirect, so the key can never travel to another address.
- It exits with code 1 when any line failed, on a 401, a 429, any other error, a network failure, or an answer it cannot read.

### Things to know about GitHub schedules

- GitHub runs a schedule only from the default branch (`main`). The first monthly run happens only after this workflow is merged to `main`. Until then use Run now from `main`.
- A scheduled run can be delayed. GitHub says the start can slip by minutes in busy hours, and sometimes a run is skipped. If the 2nd of the month passes with no run, press Run now.
- In a public repository GitHub switches scheduled workflows off after 60 days with no repository activity (no commits, pull requests or issues). A month is shorter than that, but a quiet repository can still hit it. GitHub usually sends an email when it happens, but do not rely on that. To turn it back on: Actions tab, pick **Maintenance**, press **Enable workflow**, then press Run now to catch up. Once a quarter, look at the Actions tab and check that last month's run is there.

### What a red run means

The run page shows a red cross and GitHub emails the owner (D-22). GitHub sends a scheduled run's failure email to the person who last changed the workflow's `cron` line, so keep Actions emails switched on in that person's GitHub notification settings. There is no screen in the site for this.

Open the run, then the **Summary**. It lists one line per result, for example `- Expired request keys removed: 2`, then a closing sentence: "All maintenance jobs finished." or "Some maintenance jobs failed. See the lines above." The script's own fixed sentences mean:

| Line in the summary | What it means | What to do |
|---|---|---|
| The maintenance key was refused. | The site answered 401 | Check that `MAINTENANCE_KEY` in GitHub and `Maintenance__Key` on the host are the same value |
| Another maintenance run was still going after 5 tries. | The site answered 409 five times in a row | Wait 10 minutes and press Run now |
| The site refused the call because there were too many calls (HTTP 429). Wait and run it again. | The per-address limit was reached | Wait 10 minutes and press Run now |
| The site answered with an error (HTTP 500). | The site is down or failed. The number is the status | Check the site and the host log, then press Run now |
| The site could not be reached. | A network or address problem | Check `SITE_ORIGIN` and that the site is up, then press Run now |
| The site gave an answer this script could not read. | The reply did not have the expected shape | Check the server version and the host log |
| SITE_ORIGIN must be an https address with no path, such as https://example.test. | The variable is missing or wrong. Nothing was sent | Fix the variable |
| MAINTENANCE_KEY is not set correctly. | The secret is missing or holds spaces or line breaks. Nothing was sent | Fix the secret |
| Stopped after 10 calls with work still left. Run it again. | A long backlog | Press Run now again. Each run carries on from where the last stopped |
| A job line such as "The job failed. Check the server log." | One job threw an error. The others still ran | Read the host log, fix the cause, press Run now |

The summary and the run log are public, because the repository is public. They hold only the labels above, numbers and these fixed sentences. They never hold the key, the raw answer, an error body, an id or an address (D-36).

## The call

| | |
|---|---|
| Method and path | `POST /api/v1/maintenance/run` |
| Header | `X-Maintenance-Key` holds the key |
| Body | None |
| Cache | Never cached |

Put the real site address in front of the path. There is no sign-in, no cookie and no idempotency header.

## What the answer means

The answer is plain counts. It never holds a name, an address, an account id or an error text (D-36).

- `ok` is true when no line failed. When it is false, the GitHub run turns red and GitHub emails the owner.
- `more` is true when a job ran out of its 90 seconds and still has work. The next run carries on.
- `lines` has one line per job result, for example "Expired request keys removed", with its count.

### Other answers

| Answer | Meaning | What to do |
|---|---|---|
| 401 | The key is missing, wrong or not set on the host. The message is the same in all three cases on purpose. | Check that the GitHub secret and the host value are the same, and that the key is at least 32 characters. |
| 409 | Another run is already going. Nothing was started. | Wait a few minutes and run again. |
| 429 | Too many calls from one address. The answer carries a `Retry-After` header in seconds. | Wait that long. The default limit is 12 calls in 10 minutes per address. |

A 401 also counts toward the 429 limit. That is what stops anyone from guessing the key.

The limit can be changed on the host with `RateLimits__Maintenance__PermitLimit` and `RateLimits__Maintenance__Window`.
The window must be at least 6 seconds, and the limit at least 1.

## The key

### How to make one

- At least 32 random characters. Longer is fine.
- Make it in a password manager and let the manager generate it. Do not invent it by hand.
- Use letters and digits. Avoid spaces, because the value travels in a header.
- A key shorter than 32 characters is never accepted, even when both sides match. The endpoint then stays closed.

### Where it lives

The same value is kept in three places and nowhere else:

| Place | Name | Used for |
|---|---|---|
| App pool environment variable on the host | `Maintenance__Key` | The server compares each call with it |
| Dev user-secrets on the developer machine | `Maintenance:Key` | Running the site locally |
| GitHub repository secret | `MAINTENANCE_KEY` | The workflow sends it in the header |

The key is never written to a settings file, to the repository, to a log or to this page. The server hides any logged
value called `MaintenanceKey`, and a test checks that the key is not in any log line or answer.

### How to rotate it

1. Make a new key as described above.
2. Change the host value `Maintenance__Key` and the GitHub secret `MAINTENANCE_KEY` together, one right after the other.
3. Restart the app pool if the host does not pick up the change by itself.
4. Use "Run now" on the workflow to prove the new key works. A 200 means it does.

The next run uses the new key. Between the two changes a run would get a 401, so do not change them while a run is going.

Rotate the key at once if it was pasted somewhere public, shown on a screen share or sent in a message.

## Counts only (D-36)

The run summary shows counts and fixed labels only. Nothing that identifies the Cloudinary account, a photo, a person or
an address is ever written in an answer or in the GitHub run log. When you add a job, keep to this rule.

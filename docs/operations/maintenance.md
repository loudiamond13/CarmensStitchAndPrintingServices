# Maintenance run: what it does, the key and how to rotate it

*Created: 2026-11-03T12:20:00-06:00 · Updated: 2026-11-03T17:30:00-06:00*

The maintenance run is one web call that cleans up the database and the photo storage (JOB-01, D-21). A scheduled GitHub
Actions workflow (added by a later plan) makes the call once a month. That workflow also has a manual "Run now" button. Nobody else uses it, and
it is not part of the public API description.

The call is protected by a secret key. This page says where the key lives and how to change it. It never shows a key,
and no example here looks like one.

## What one run does

One run does every job once, in this order. The number is the job's place in the order.

| Order | Job | What it reports |
|---|---|---|
| 10 | Purge of expired records | One count per purge rule (see the table below) |
| 20 | Stray file sweep (a later plan) | How many stray files it removed |
| 30 | Photo removals (a later plan) | How many photos it removed from storage, and how many are still failing |
| 40 | Usage report (a later plan) | Storage and credit use against the free plan |

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

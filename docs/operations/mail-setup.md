---
created: 2026-10-14T18:00:00-05:00
updated: 2026-10-18T07:10:00-05:00
---

# Mail setup: the app's sender mailbox and the .NET security update

The new sign-in needs to email a 6-digit code to staff. Those emails must leave from the business domain, and the domain's mail rules are strict (SPF ends `-all` and DMARC is `p=reject`), so a message only arrives if it is sent through SmarterASP.NET's own mail server and signed with DKIM. This page is the checklist for that, plus one update for this computer. It follows decisions D-26, D-34 and D-35 of Phase 4.

You do steps 1 to 5. Claude never changes your DNS, your mail panel or the live site. Nothing here costs money.

**Golden rule:** the existing SPF record and the existing `_dmarc` record stay exactly as they are. You only **add** the DKIM record. A domain with two SPF records loses all its mail.

## Step 1. Create the mailbox

1. Sign in to the SmarterASP.NET control panel and open **Email**.
2. Create the mailbox `no-reply@cspstailoring.com`.
3. Display name: `Carmen's Stitch & Printing`.
4. Turn off forwarding and auto-reply. Only the app uses this mailbox, and replies are not read.
5. Choose a long password and keep it in your password manager. You will type it once in step 3.

## Step 2. Turn on DKIM and add its DNS record

DKIM is a signature that lets Gmail and others trust the message really came from your domain.

1. Before you change anything, look at what exists. In PowerShell:

   ```powershell
   nslookup -type=TXT cspstailoring.com
   nslookup -type=TXT _dmarc.cspstailoring.com
   ```

   Note the one line that starts with `v=spf1 a mx include:_spf.site4now.net -all` and the one that starts with `v=DMARC1;p=reject`. Do not edit, delete or duplicate either of them.
2. In the control panel, open **Email**, then **DKIM**, and enable DKIM for `cspstailoring.com`. The panel shows a record name (a selector such as `something._domainkey`) and a long value.
3. In the DNS manager of `cspstailoring.com`, **add** a new TXT record with exactly that name and value. Add only this one record.
4. Wait a few minutes (sometimes up to an hour), then check the new record is visible, using the record name from the panel:

   ```powershell
   nslookup -type=TXT <record-name-from-the-panel>.cspstailoring.com
   ```

5. Run the two `nslookup` commands from item 1 again. The SPF and DMARC lines must be identical to before, and there must still be exactly one `v=spf1` line.

## Step 3. Store the mail settings on this computer

Run this in a normal (not administrator) PowerShell window; the full path works from any folder. It asks questions and stores the answers in your private user-secrets store, never in git. Nothing you type is shown again, and the password is hidden while you type.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\CarmensStitchAndPrintingServices\tools\scripts\Initialize-DevSecrets.ps1 -Smtp
```

| Prompt | What to type |
|--------|--------------|
| `Smtp:Host` | The SMTP server name shown in the panel for this mailbox (Email, then the mailbox's SMTP settings). |
| `Smtp:Port` | Press Enter for 587, unless the panel says another port. |
| `Smtp:Security` | Press Enter for `StartTls` (port 587). Type `SslOnConnect` if the panel says SSL on port 465. Mail without encryption is not accepted. |
| `Smtp:UserName` | Press Enter for `no-reply@cspstailoring.com`. |
| `Smtp:Password` | The mailbox password from step 1. |

The script prints only the names it stored. Never paste the password anywhere, including to Claude.

## Step 4. Send a test message and read Gmail's verdict

1. Open the webmail of the new mailbox and send a short test message to a Gmail address you own.
2. Open it in Gmail (check Spam too). Click the three dots, then **Show original**.
3. At the top of that page Gmail lists three results. Paste back only these three lines:
   - `SPF: PASS ...`
   - `DKIM: PASS ... d=cspstailoring.com` (the `d=` part must name `cspstailoring.com`)
   - `DMARC: PASS ...`

`PASS` on all three is what we need. If any line says `FAIL`, `NEUTRAL` or is missing, stop and paste the line anyway. The usual cause is that the DKIM record from step 2 is not visible yet, or its value was copied with a missing piece. Do not change SPF or DMARC to fix it.

## Step 5. Install the .NET security update on this computer

This is the 2026-10-13 Microsoft security release. It is a free Microsoft download (free to use, no payment).

1. Go to <https://dotnet.microsoft.com/download/dotnet/10.0>.
2. Install **ASP.NET Core Runtime 10.0.13** and **SDK 10.0.402**. The installer needs administrator rights.
3. Open a new terminal and run:

   ```powershell
   dotnet --list-runtimes
   ```

4. Paste back the line that reads `Microsoft.AspNetCore.App 10.0.13`.

## Preview the emails

The eight emails staff receive (sign-in code, account locked, password reset, password changed, reset by a Manager, deactivated account, invite, sign-in email changed by a Manager) are designed to match the site. Look at them before they go live. The preview uses made-up sample values (code 482913, Carmen Reyes, a token that does not work), so nothing real is in it. It runs only in Development and refuses anywhere else.

Both commands run in a normal PowerShell window from the project folder, and the second line makes this terminal a Development one only for that window.

**Look at them as files (no mail is sent).** Open the `.html` files in a browser and the `.txt` files in Notepad:

```powershell
$env:DOTNET_ENVIRONMENT = 'Development'
dotnet run --project tools/Csps.EmailPreview -- --out artifacts/email-preview
```

**Send all seven to your own Gmail** through the real mailbox (needs the mail settings from step 3). Replace the address with yours; it prints only how many were sent:

```powershell
$env:DOTNET_ENVIRONMENT = 'Development'
dotnet run --project tools/Csps.EmailPreview -- --to you@gmail.com
```

In Gmail on the web and in the Gmail app on your phone, open each one and check:

- The CSPS logo shows at the top without pressing "load images".
- The colours and fonts look like the site, and the card fits the phone screen.
- The sign-in code email has the code in its subject and in a big box you can select and copy.
- Each button opens its page (the links point at your local site, `http://localhost:5180`, unless you add `--public-base-url https://your-site`).
- In Gmail, the three dots and **Show original** show the plain-text version with the same words.

## What to send back

- The three Gmail lines (SPF, DKIM with `d=cspstailoring.com`, DMARC).
- The `Microsoft.AspNetCore.App 10.0.13` line.

Claude then records them in `.planning/HOSTING-RECORD.md` and the rest of Phase 4 can start.

## Outbox retention

Every email the app sends goes through a table of queued messages (the outbox). This is the written rule for how long its rows live (review note IN-08 of Phase 4).

- **While a row is open** (waiting to send or being retried), it holds the encrypted subject and bodies, so the message can be sent.
- **When a row is closed** (sent, or given up after the retries), the app clears the subject and bodies at once. What stays is the recipient address, the kind of email, the times and the result code, so staff can see that a sign-in code or reset link was sent and when.
- **Closed rows are deleted 30 days after they close.** The recipient address is personal data, so it is not kept longer than that. The deleting is done by the maintenance job planned for Phase 9 (requirement JOB-01). Until that job exists, closed rows stay, which is why this is recorded as deferred in `.planning/phases/05-profile-user-management/deferred-items.md`.
- **When a user is deleted,** the rows addressed to that user are scrubbed at delete time (plan 05-26 of Phase 5), without waiting for the 30 days.

Nothing here needs action from you. It is written down so the rule is clear and the Phase 9 job has a definition to follow.

## If mail ever stops

Staff cannot sign in without the emailed code, and there is no way around it. The app retries a failed email quietly for about 10 minutes and the person can press Resend after 60 seconds. If it keeps failing, fix the mailbox first (D-33): check that the mailbox password has not changed, that the mailbox is not full or locked, and that the host's SMTP name and port in the panel still match what is stored. Then run step 3 again to re-enter the settings. Do not touch SPF or DMARC.

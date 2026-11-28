# Runbook: a possible data breach

*Created: 2026-11-27T21:02:00-06:00 · Updated: 2026-11-27T21:02:00-06:00*

A breach is when someone who should not see or change our data does, or might have. Examples: a staff password in the wrong hands, a lost phone that is signed in to the admin area, a customer's details sent to the wrong person, or a secret that was posted somewhere public.

This page splits the first hours into what a Manager does at once and what only the owner does (LEGAL-06). The owner is the Data Protection Officer. A Manager brings every possible breach to the owner, even a small one and even a doubtful one.

Claude is not a lawyer. This page is not legal advice. Each legal point below is marked, and the owner should confirm it with the NPC or an adviser.

## First steps for a Manager

Do these on the screens the app already has. They stop more harm and they lose nothing.

1. **Write down the time** you learned of it and what you saw. Keep the note outside git. Put no customer details in it that you do not need.
2. **Find the account** in **Users**. You cannot do these steps to your own account (the app refuses). If it is your own account, go to step 6 and tell the owner at once.
3. **Stop the account right now with Deactivate.** Press the row button **Deactivate** next to the person, then confirm **Deactivate User**. They are signed out on every device and cannot sign in. Their records stay on orders and expenses. **Activate** brings them back later.
4. **Or reset a password the other way.** If the person is still trusted but their password may be known, open **Edit** for them and use **Set Temporary Password** under Account access. This ends every session of theirs at once. The app emails them a notice, and the next sign-in goes through the emailed code and then asks for a new password. Share the temporary password only in private. The app refuses this on a locked or deactivated account, so use one step or the other, then go on.
5. **Ending sessions:** there is no separate button for another person's devices. Deactivate, Lock and Set Temporary Password each end every session of that person. A person who fears for their own account can open **Signed-in Devices** and press **Sign Out Other Devices**, and change the password in **My Profile**, then tell the owner.
6. **Message the owner at once.** Say what you saw, when, which account, and what you already did. Do not wait to be sure.
7. **Change nothing else.** Do not delete records, do not try to clean up, and do not tell customers anything. Those steps are the owner's.

## Tell the owner at once

Contact the owner the way you usually do. No phone number or email is written in this page, on purpose. Give:

- the time you learned of it, and how
- the account or the thing that is affected
- what you already did (Deactivate, a temporary password, and so on)
- whether customers' details may be involved

The 72-hour clock below may already be running, so do not leave this for the next day.

## Owner-only steps

These stay with the owner. A Manager does not do them.

1. **Change the secrets** that may be exposed. Pick the ones that match what happened. Type each new value straight into the host or GitHub page, and never write it in git, chat or email.

   | Secret | Where | How |
   |---|---|---|
   | Data Protection certificate | host settings | [data-protection-rotation.md](data-protection-rotation.md) |
   | JWT signing key (`Jwt__SigningKey`) and code MAC key (`Auth__CodeMacKey`) | host settings | [cutover-runbook.md](cutover-runbook.md) shows how they are made. Changing the signing key signs everyone out. |
   | Mailbox password (`Smtp__Password`) | mail panel, then host settings | [mail-setup.md](mail-setup.md) |
   | Cloudinary keys (`Cloudinary__ApiKey`, `Cloudinary__ApiSecret`) | Cloudinary, then host settings | [cloudinary-setup.md](cloudinary-setup.md) |
   | Maintenance key (`Maintenance__Key` and the GitHub secret `MAINTENANCE_KEY`) | host settings and GitHub | [maintenance.md](maintenance.md) |
   | Web Deploy password (the GitHub secret `WEBDEPLOY_PASSWORD`) | host panel and GitHub | [ci.md](ci.md) and [deploy.md](deploy.md) |
   | Database user password (`ConnectionStrings__Csps`) | host panel and host settings | [cutover-runbook.md](cutover-runbook.md) |

2. **The holding page.** To keep visitors away while the owner works, the site can show its "back in a minute" holding page. Today the Deploy workflow shows that page only while a deploy runs, and its `online` action takes it down (see [Recover with the online action](deploy.md#recover-with-the-online-action)). It has no action that puts the page up on its own. The owner decides how to take the site offline now, for example in the host's control panel. This gap is listed for the owner to rule on, and nothing is built for it here.
3. **Any notice** to the National Privacy Commission (NPC) or to customers. The owner decides, with the NPC or an adviser. A Manager never sends one.

## The 72-hour clock

By default this page follows the 72-hour notice rule of the Data Privacy Act (RA 10173) and NPC Circular 16-03.

- The owner reports a breach that needs notice to the NPC, and tells the affected people, **within 72 hours** of knowing or reasonably believing it happened.
- Count from the time you wrote down in step 1. Treat the clock as running from the moment a Manager knows, until the owner says otherwise.
- An early notice may be incomplete. A fuller report can follow later. Sources say within five days.

Claude is not a lawyer: confirm with the NPC or an adviser when the clock starts, what counts as needing notice, and what the early notice must hold.

## Evidence to keep

Do not delete anything. Evidence is how the owner shows what happened.

- **The audit log** records who did what in the admin area. Nobody can change an entry, and entries are removed after 8 months. See [audit-log.md](audit-log.md). Note the entries that matter on the **Audit Log** screen.
- **The log files** on the host are kept 30 days, then removed. If the breach may be older than a few days, the owner should save copies of the logs from the host at once, and keep them outside git.
- **Emails, screenshots and your own note** stay as they are. Keep them outside git.
- Put no customer details, secrets or contact details of any person in git or in this page.

## Points to confirm with the NPC or an adviser

Claude is not a lawyer. These points came from public pages and secondary sources, and the owner should confirm each one with the NPC or an adviser before relying on it.

| Point | What we assumed |
|---|---|
| The 72-hour start | From knowing or reasonably believing a breach that needs notice happened. Confirm with the NPC or an adviser. |
| Early, incomplete notice | Allowed, with a fuller report later (sources say within five days). Confirm with the NPC or an adviser. |
| No delay | No delay when at least 100 people are affected, or when sensitive personal information may cause harm. Confirm with the NPC or an adviser. |
| Allowed delay | Only to find the scope, stop further disclosure or restore integrity. Confirm with the NPC or an adviser. |
| Filing through the NPC's online breach system | NPC Advisory 2026-02 says it does not replace the Circular's duties. Confirm with the NPC or an adviser. |
| Telling customers | Whether, when and in what words. Confirm with the NPC or an adviser. |

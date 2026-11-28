# Runbook: sign-in emails stop arriving

*Created: 2026-11-27T21:10:00-06:00 · Updated: 2026-11-27T21:10:00-06:00*

Every staff sign-in ends with a 6-digit code sent by email. Invitations and password reset links also go by email. If CSPS cannot send mail, nobody can finish signing in (14 D-21, 04 D-29).

**There is never a way around the emailed code.** No command, flag, setting or database edit signs a person in without it, and none will be added. The only fix for broken mail is to fix the mail. This is the same rule as in [bootstrap-manager.md](bootstrap-manager.md).

## What you see

- The person enters the right password and waits, but no code email comes.
- The app retries a failed email quietly for about 10 minutes. The person can press **Resend Code** after 60 seconds.
- Invitations and reset links do not arrive either.

## Fix it

Do these in order. The owner does them, because they use the host and mail panels.

1. **Check the person's spam folder** and that they use the newest code email.
2. **Check the mailbox that sends the mail** (see [mail-setup.md](mail-setup.md)). The usual causes are in this order:
   - the mailbox password was changed
   - the mailbox is full or locked in the mail panel
   - the host's SMTP name or port no longer matches what is stored
3. **Correct the SMTP settings** in the host's app settings (`Smtp__Host`, `Smtp__Port`, `Smtp__Security`, `Smtp__UserName`, `Smtp__Password`) and restart the site. [mail-setup.md](mail-setup.md) lists each value and where it comes from.
4. **Do not touch SPF or DMARC.** The existing records stay exactly as they are. Only the DKIM record is added.
5. Queued emails are sent once mail works, until they expire. A code lasts 15 minutes, so the person asks for a new one with **Resend Code**.
6. An invitation or reset link that expired meanwhile needs a new one: a Manager uses **Resend Invitation** or **Send Reset Link** in **Users**. See [lockout.md](lockout.md).

## If it still fails

Tell the owner. The owner may ask Claude to look at the mail errors in the logs. Do not ask for a bypass. A request for one is a request to weaken staff-account security and needs the owner's explicit decision on record.

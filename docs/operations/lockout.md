# Runbook: a staff member cannot sign in (lockouts)

*Created: 2026-11-27T21:08:00-06:00 · Updated: 2026-11-28T02:15:02-06:00*

This page covers the ways a staff account stops working, and how to get it back (14 D-20, D-21). If the problem is that the emailed code never arrives, read [break-glass-mail.md](break-glass-mail.md) instead.

The sign-in screen never says why a sign-in failed. A wrong password, a pause, a Manager lock, a deactivated account and a deleted account all show the same line: "Email or password is incorrect." So check the person in **Users** before you guess.

## Which kind of stop is it

| What happened | How long | Who lifts it |
|---|---|---|
| Five wrong passwords in a row | A pause of 15 minutes | It ends by itself. A password reset also ends it. |
| Ten wrong codes in an hour (counted across every sign-in try) | A pause of 15 minutes. The screen says "Too many wrong codes", and the person gets an email | It ends by itself. A password reset also ends it. |
| Five wrong tries on one emailed code | No pause. That code stops working and the screen says "This code can't be used anymore. Use Resend Code to get a new one." | The person presses Resend Code. Those wrong tries still count toward the ten in an hour. |
| A Manager pressed **Lock** | No timer | A Manager, with **Unlock**. A password reset does not help. |
| A Manager pressed **Deactivate** | No timer | A Manager, with **Activate**. |
| The account was deleted | For good | A Manager invites the person again (the address is free for a new invitation). |

## Wait out the 15 minutes

For a pause after wrong passwords or wrong codes, the simplest fix is to wait 15 minutes and try again carefully. Tell the person to type the password slowly and to use the newest code email only.

## Reset the password by email

1. On the sign-in screen the person chooses **Forgot password?** and types their email.
2. They get an email with a reset link. The link works for 30 minutes and only once. Up to three reset emails are sent per hour.
3. They set a new password. This ends the 15-minute pause and every session they had. They then sign in with the emailed code, as always.

A Manager can do the same from **Users**. Open the person with **Edit**, and under Account access use **Send Reset Link**, or **Set Temporary Password** if they cannot read email. The app refuses both on a locked or deactivated account, so lift that first.

A reset never lifts a Manager lock, a deactivation or a deletion.

## Lift a Manager lock or a deactivation

1. Sign in as a Manager and open **Users**.
2. For a lock, open the person with **Edit**, and under Account access press **Unlock**. For a deactivation, press the row button **Activate**.
3. The person can sign in again with their old password. If they forgot it, use the email reset above.

A Manager cannot lock, deactivate or delete their own account. So a Manager can only be locked by another Manager.

## Only one Manager, and that Manager is locked

One active Manager is fine. There is no two-Manager rule and no warning in the app (14 D-20).

If the only Manager is locked and there is no second Manager to press Unlock, nobody can do it in the app. This is fixed by a **reviewed one-off step** that Claude prepares when the owner asks:

- The owner says yes before it runs. Claude never runs it alone.
- It uses the ORM, never inline SQL.
- It is **not built in advance**. Nothing sits ready to run, so nothing can be misused.
- It changes the lock and nothing else. It does not bypass the password or the emailed code.

[bootstrap-manager.md](bootstrap-manager.md) describes a separate command that creates a new Manager when no active Manager exists. Whether to use it or the one-off unlock is the owner's decision.

To avoid the situation, keep a second Manager when you can. It is not required.

## What never happens

- No command, flag, setting or database edit signs someone in without the password and the emailed code.
- A locked account is never opened by editing the database by hand.
- Any request to add such a way is a request to weaken staff-account security. It needs the owner's explicit decision on record.

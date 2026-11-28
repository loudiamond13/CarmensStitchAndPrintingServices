# Runbook: make a backup and prove it can be restored

*Created: 2026-11-27T21:09:00-06:00 · Updated: 2026-11-28T02:11:11-06:00*

A backup you have never restored is only a hope. This page takes the owner from a fresh backup of the live database to a checked copy on this PC, and then drops the copy (SEC-05, 14 D-07, D-40). Nothing here changes the live site or runs anything on the live database.

The drill uses one script, [`tools/scripts/Restore-BackupDrill.ps1`](../../tools/scripts/Restore-BackupDrill.ps1). It can only ever touch one database on this PC, called `CSPS_RestoreDrill`. It cannot be pointed anywhere else, and it only reads a backup from this project's `_local` folder.

Rules for the whole drill:

- The backup holds real staff accounts, quote requests and queued emails. It stays in `_local`, which Git ignores. Never commit it, upload it, email it or paste any of it into chat.
- The receipt the script writes holds names and counts only, and it also stays in `_local`.
- The copy still holds the queued emails. Never let the app send mail while it is open against the copy (see "Open the app against it").
- Never touch the other databases on this PC. The script does not, and you should not either.

## Make the backup

1. In the hosting control panel, make a backup of the live database and download it by FTP into this project's `_local` folder, for example as `_local\drill-20261127.bak`. Use the control panel's own backup tool.
2. At the same moment, write down what the live admin shows: how many Orders, how many Users (count everyone, including deactivated people) and how many Quote Requests (count them all, not a filtered view). These are the numbers the copy must match.
3. Write down the release you have deployed, and its last migration. In a checkout of that release, the last line of this command is the last migration. Only the name after the date is needed.

   ```powershell
   dotnet ef migrations list --project src/Csps.Infrastructure --startup-project src/Csps.Server --no-connect
   ```

Backups are manual today: a control-panel backup downloaded by the owner, at least once a month and before every deploy. Whether that becomes a scheduled job is the open decision D-51, which is settled before the Phase 17 cutover.

## Restore it on this PC

1. Run the shared-machine preflight. If a port is in use by another project, or the other project's test processes are listed, wait. Never stop another project's processes.

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199
   ```

2. Run the script with the backup and the numbers you wrote down. Replace the example numbers and name with yours.

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Restore-BackupDrill.ps1 -BakPath _local\drill-20261127.bak -ExpectedOrders 120 -ExpectedUsers 4 -ExpectedQuoteRequests 35 -ExpectedMigration ExampleMigrationName
   ```

3. What the script does, in order:
   - It refuses anything that is not a `.bak` file inside `_local`, before it connects.
   - It reads the backup's file list and runs `RESTORE VERIFYONLY`. A bad file stops here and nothing changes.
   - It restores into `CSPS_RestoreDrill` on `(localdb)\MSSQLLocalDB`. If the copy already exists it stops. Add `-Replace` to drop the old copy and restore again.
   - It runs `DBCC CHECKDB` on the copy.
   - It writes `_local/restore-drill-receipt.md`.

The production database is SQL Server 2025 RTM-CU3, version 17.0.4025.3. The local server on this PC is the same version, so this is a same-version restore. If the local version ever differs, the receipt shows it (the "Local server version" row), and a restore to an older version is refused by SQL Server itself.

## Check it

Open `_local/restore-drill-receipt.md`. A good drill shows:

- RESTORE VERIFYONLY: Passed.
- DBCC CHECKDB: Passed.
- Reads after the restore: All read. If it names something that failed, the console shows why (for example a backup with no migration history table), and the script exits with code 3.
- Orders, Users and Quote Requests each say Match, and Last migration says Match.
- Overall: All checks passed.

A Mismatch means the copy holds a different number than the live admin showed at backup time. Look at the "Tables" list in the receipt. A small difference can be real work done between your count and the backup, so redo the count and the backup close together before you worry. A difference that stays is a real problem: tell Claude and do not go on.

The row counts come from SQL Server's catalog views, which are exact on a fresh restore but are documented as approximate. If `DBCC CHECKDB` passed and a count is off by only a few rows, confirm it in the admin before you treat it as data loss.

The script exits with code 3 when a check failed or a number did not match. The receipt still gets written so you can see which one.

## Open the app against it

This check proves the copy is a working database for this version of the app. It only asks four things: the host starts, `/health` answers, no migration is pending, and the sign-in page loads.

The copy holds the real email outbox. If the app ran against it with working mail settings and the production certificate, it could send queued emails to real people. So:

- Use the Development host, on one process, with the mail host set to `smtp.invalid` (a name that can never exist, so no mail can leave). The setting applies only to that one terminal window.
- Use the dev certificate from your user-secrets, never the production certificate. Do not set the production certificate or mail credentials in this window.
- Do not sign in. The sign-in code email cannot and must not go out from the copy.

1. Run the preflight again (see above). Then, in one terminal window, start the host against the copy:

   ```powershell
   $env:ConnectionStrings__Csps = 'Server=(localdb)\MSSQLLocalDB;Database=CSPS_RestoreDrill;Integrated Security=true'
   $env:Smtp__Host = 'smtp.invalid'
   dotnet run --project src/Csps.Server --launch-profile http
   ```

2. In a second window, check `http://localhost:5115/health`. It should answer.
3. In a third window, from the same checkout, check that no migration is pending. Every line should be marked applied.

   ```powershell
   dotnet ef migrations list --project src/Csps.Infrastructure --startup-project src/Csps.Server --connection "Server=(localdb)\MSSQLLocalDB;Database=CSPS_RestoreDrill;Integrated Security=true"
   ```

4. Start the web app with `npm --prefix web run dev` and open `http://localhost:5180/admin/login`. The sign-in page should load. Stop there and do not sign in.
5. Stop the host and the web app with Ctrl+C in each window, then close the window that held the settings. Leave nothing running.

## Drop the copy

Drop the checked copy as soon as you are done. It holds real data.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Restore-BackupDrill.ps1 -Drop
```

`-Drop` drops `CSPS_RestoreDrill` and nothing else. If the copy is not there, it says so and stops.

## What stays on this PC

- The `.bak` stays in `_local` until the owner deletes it. It is never committed, uploaded or deployed.
- The receipt stays in `_local/restore-drill-receipt.md`. It lists production table names and row counts, so it is never committed either.
- Claude may read the receipt's Match and Mismatch lines to record that the drill passed. Claude does not open the `.bak`.
- Nothing from the copy goes into the repository, a pull request or an issue. Record only the result: the date, the release, and "all checks passed" or what failed.

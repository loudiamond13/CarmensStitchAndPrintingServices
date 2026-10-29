# Guide: running the legacy fit check

*Created: 2026-10-29T10:30:00-05:00 · Updated: 2026-10-29T10:30:00-05:00*

The legacy fit check (Phase 7.1) answers one question before Phase 8 builds on the order rules: which legacy records break the CSPS order and expense rules? It lists them. It changes nothing. This page says what it reads, what it writes, how to run it, and what to do with its two output files.

## What the check does

- It reads the legacy orders, items, payments, discounts, expenses, lists and the people tables from the restored legacy database (07.1 D-07). It never writes to it and never restores over anything.
- It turns each legacy order into the shape the Phase 7 import expects, using a draft mapping that is provisional (D-04), and runs it through the order rules. It lists every rule a record breaks, every relaxation it relies on, and every stored total that differs from the CSPS math (D-08).
- It imports each mappable order into a throwaway trial database, to prove the real import path accepts it. It also judges each legacy company expense against the Phase 6 expense rules, report only (D-12). Nothing is saved to any real database.
- It never derives a schema. The CSPS schema comes from the EF migrations, as always (D-33).

## What it touches

| What | How |
|---|---|
| `CSPS_Legacy_Restore` on `(localdb)\MSSQLLocalDB` | Read only. One read transaction, never committed. The tool counts the tables, rows and index updates before and after, and fails the run if they differ. |
| `CSPS_Test_{guid}` on the same instance | Created at the start of the import step and dropped at the end. The run then asks the server again and fails if the database is still there. |
| `_local/legacy-fit-check/` in the repository | The two output files below. Nothing else is written. |

The targets are fixed in code. No argument or environment variable can point the tool somewhere else. The tool refuses to start against any other database name.

## Before a run

Run the shared-machine check and wait if another project is busy.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199
```

The restore must already be in place. It is replaced only with `tools/scripts/Restore-LegacyReceipt.ps1`, and never over `CSPS_Dev`. The first real run waits for the owner's go-ahead (plan 07.1-10).

## How to run it

```powershell
dotnet run --project tools/Csps.LegacyFitCheck
```

It takes no arguments. Any argument is refused with a usage message.

| Exit code | Meaning |
|---|---|
| 0 | Done. Both files were written. |
| 1 | Failed. The restore changed during the run, the trial database could not be removed, the summary held a personal value, or something threw. The message names the kind of failure only. |
| 2 | Refused. The source or the trial server is not one the tool may use. Nothing was created. |
| 64 | Usage error. Arguments were given. |

The console shows counts and two repository-relative paths, never a name, a note or an amount:

```text
Orders checked: 1200. Company expenses checked: 340. Findings: 2100.
Full list (never commit): _local/legacy-fit-check/findings-20261029-153000.md
Summary (counts only): _local/legacy-fit-check/summary-20261029-153000.md
```

## The two output files

| File | Holds | What to do with it |
|---|---|---|
| `findings-{stamp}.md` | The full list: legacy keys, names, notes, amounts, people text and messages. | Private. Never commit, upload or deploy it (D-01). The `_local/` folder is ignored by git. |
| `summary-{stamp}.md` | Counts per rule in plain words, such as "Payments with no payment method: 155 payments". No name, phone, email, note, order number or legacy row id. | Review it. After the owner's review it is copied into `07.1-FINDINGS.md` and committed (D-02). |

How the split is kept:

- The full list is written only inside the repository's `_local/legacy-fit-check` folder. A folder not named `_local`, a path that escapes it, a link (reparse point) on the folder or the file, and a file that already exists are all refused.
- The summary is built only from counts and the type of each finding. A list word (an order type, status or role name read in the run, or a CSPS list name) is printed only when it is on the allow-list. Any other list word shows as "(a list value)".
- Before the summary is written, a self-check searches it for every personal-looking text the run read: order names and notes, payer and receiver text, discount givers, user names and emails, descriptions and the derived order numbers. If one appears, the summary is not written, the run exits with 1 and prints "Failed: the summary held a personal value, so it was not written." The full list is still written, because it stays private. Do not copy anything from `_local/` in that case. Tell the developer.
- The self-check is strict on purpose. A read value of three or more characters that is also a plain word in the summary will refuse it. A refusal never says which value matched.

## Clean-up after a killed run

A run that is killed hard can leave its trial database behind. Remove it with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Remove-StaleTestDatabases.ps1 -WhatIf
powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Remove-StaleTestDatabases.ps1
```

The script drops only names that match `^CSPS_Test_[0-9a-f-]{36}$` and are older than two hours. It never touches `CSPS_Legacy_Restore`, `CSPS_Dev`, `CSPS_E2E` or any `BetsLLC_*` database.

## Limits of the summary

- Within one field only the first message shows.
- The figure rules of an order with a structural break are not judged.
- The date reading (as stored, or moved to the business zone) is a provisional guess. The summary counts the records where the two readings differ, so the owner can rule on it.

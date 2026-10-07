# Checking the hosting: what to do and what to send back

Plan 01-13, D-28 option A (approved 2026-10-07). About 20–40 minutes.

**Ground rules (please read first):**
1. **Never change the live website or its database (`csptailoringdb`).** Do not edit, upload to, restart or delete anything that belongs to them.
2. **Never paste secrets into the chat.** That means passwords, database login names, connection strings and the probe key. If a screen shows one of these, leave it out.
3. **Hide the last number of your own internet (IP) address.** Replace it with `x`, so `203.0.113.45` becomes `203.0.113.x`. If you can't tell which address is yours, do this to every IP address you paste. That is fine.
4. **You can skip any part.** If something is confusing, unavailable, or would mean touching the live site, stop and write `skip <part>: <short reason>`. Skipped items are marked "Unverified". Nothing is guessed.

Do the four parts in order: A, B, C, then D.

## Part A: Read these control-panel screens (look only)

Log in to the SmarterASP.NET control panel. Write down what each screen shows:

- **A1.** Account or billing page: the name of your hosting plan (for example "Basic").
- **A2.** Databases page: how many databases your plan allows, and how many you use now.
- **A3.** Databases page or plan page: the database size limit.
- **A4.** Website settings: every .NET / ASP.NET version on offer (for example ".NET 10").
- **A5.** Sites list and Databases list: are the live website and `csptailoringdb` in **this same account**? (yes or no)
- **A6.** Website settings: how a site gets its settings. Is there an "environment variables" screen, can you edit `web.config`, or neither?
- **A7.** Site tools or deployment page: is "Web Deploy" offered? (yes or no)
- **A8.** Tools page: are "scheduled tasks" offered on your plan? (yes or no)
- **A9.** Sites page or plan page: is a "staging" site or slot offered? (yes or no)

## Part B: Look-only database questions

1. Open the control panel's database query tool. If you already use SQL Server Management Studio with this database, that works too.
2. Choose the live database, `csptailoringdb`.
3. Paste in **one query at a time**, run it, and copy the answer grid as text. If copying doesn't work, type the values.
4. Every query below starts with `SELECT` and only reads. **If the tool ever asks you to "save", "commit" or "apply changes", stop and tell Claude.**

**B1.**
```sql
SELECT @@VERSION AS Version;
```

**B2.**
```sql
SELECT SERVERPROPERTY('ProductVersion') AS ProductVersion, SERVERPROPERTY('ProductLevel') AS ProductLevel, SERVERPROPERTY('Edition') AS Edition, SERVERPROPERTY('Collation') AS ServerCollation;
```

**B3.** This should give two rows: `model`, and the live database. If only one row comes back, paste that one row.
```sql
SELECT name, compatibility_level, collation_name, is_read_committed_snapshot_on, recovery_model_desc FROM sys.databases WHERE name IN ('model', DB_NAME());
```

**B4.**
```sql
SELECT CAST(SUM(size) * 8.0 / 1024 AS decimal(10,1)) AS AllocatedMB FROM sys.database_files;
```

**B5.** Paste **only** the `IsDbOwner` number (1 or 0). Do **not** paste the `DbUser` name.
```sql
SELECT USER_NAME() AS DbUser, IS_MEMBER('db_owner') AS IsDbOwner;
```

**B6.**
```sql
SELECT permission_name FROM fn_my_permissions(NULL, 'DATABASE') ORDER BY 1;
```

## Part C: The one-time test app ("probe") on its own temporary site

The probe is a tiny test app. You open it once, it reports facts about the server, and then you delete it. It never touches any database. It only answers when you send it a secret key, and that key never leaves your computer.

**Keep ONE PowerShell window open from step C1 to step C8.** The key lives only inside that window. If you close it too early, run C1 again and upload the new zip.

**C1. Build the probe and make the key (one command, on this computer).**
1. Open **Windows PowerShell**.
2. Paste this whole line and press Enter:

```powershell
Set-Location C:\Work\CarmensStitchAndPrintingServices; dotnet publish tools/Csps.HostProbe -c Release -o artifacts/hostprobe -tl:off -v q; if ($LASTEXITCODE -ne 0) { throw 'Build failed - stop and tell Claude' }; $b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $k = ($b | ForEach-Object { $_.ToString('x2') }) -join ''; $f = 'artifacts\hostprobe\appsettings.json'; $j = Get-Content $f -Raw | ConvertFrom-Json; $j.HostProbe.Key = $k; $j | ConvertTo-Json -Depth 5 | Set-Content $f -Encoding UTF8; $zip = Join-Path ([Environment]::GetFolderPath('Desktop')) 'hostprobe.zip'; Compress-Archive -Path 'artifacts\hostprobe\*' -DestinationPath $zip -Force; Write-Host "Ready: $zip (the key is inside; it is not shown)"
```

3. When it finishes you will have `hostprobe.zip` on your Desktop. The key is inside the zip and is never shown on screen.

**C2. Create a NEW, separate site in the control panel.**
- Add a **new** website and use the free temporary address the control panel offers for it.
- **Do not** put it in the live site's folder or inside any of its sub-folders.
- **Do not** add a sub-domain of the live site's domain, because that would change the domain's DNS.
- If asked for a .NET version, choose the newest (.NET 10).
- **Stop and write `skip C: <reason>` if any of these happen:**
  - your plan won't let you add a second site;
  - the only option is the live site's folder or domain;
  - the panel warns that the new site would share or restart the live site's application pool.

**C3. Upload.**
1. Open the **new** site's file manager. Make sure you are in the new site's folder, not the live site's.
2. Upload `hostprobe.zip` there and use the file manager's "Extract" or "Unzip" option, so that `web.config` sits directly in the new site's main folder.
3. Then delete `hostprobe.zip` from the site, because it contains the key.
4. If the file manager can't unzip, unzip it on your computer and upload the 8 files.

**C4. Open the probe once.** In the **same** PowerShell window, paste this line and press Enter. When it asks, paste the new site's address, starting with `https://` (or `http://` if https doesn't work on the temporary address):

```powershell
curl.exe -s -w "\nHTTP %{http_code}\n" -H "X-Probe-Key: $k" "$((Read-Host 'Probe site address, starting with https://').TrimEnd('/'))/probe"
```

What the result means:
- **A block starting with `{` and ending with `HTTP 200`:** it worked. Go to C5.
- **`HTTP 401`:** the key doesn't match. The uploaded files are probably from an older zip. Re-upload the current Desktop zip.
- **`HTTP 503`:** the uploaded `appsettings.json` has no key. Re-upload the zip from C1.
- **An error page mentioning ".NET", "500.30" or "500.31":** copy just the error's title and number. That is useful information too.

**C5. Copy the `{ ... }` block** for pasting back. In `remoteIpAddress` and `xForwardedFor` (and `xRealIp` or `cfConnectingIp`, if they show an address), replace the **last number** of your own IP address with `x`. The key is not in this output, so don't add it.

**C6. Delete the probe site.** In the control panel, delete the new site **and its folder**. Leave the live site alone.

**C7. Confirm it is gone.** Run the C4 line again in the same window with the same address. It should show `HTTP 404`, `HTTP 000` or an error, not the `{ ... }` block. Write down what it showed.

**C8. Clean up this computer.** In the same window, paste this line and press Enter, then close the window:

```powershell
Remove-Item -Recurse -Force C:\Work\CarmensStitchAndPrintingServices\artifacts\hostprobe, (Join-Path ([Environment]::GetFolderPath('Desktop')) 'hostprobe.zip') -ErrorAction SilentlyContinue; Remove-Variable k, b, j -ErrorAction SilentlyContinue; Write-Host 'Probe files and key removed from this computer.'
```

## Part D (last): Email sender checks (SPF, DKIM, DMARC)

This needs the **live site's domain name**, for example `example.com`. It is not secret. **Nothing is changed here; we only look.**

**D1. Read the domain's public mail records.** In PowerShell, run these two lines one at a time, replacing `example.com` with your domain:

```powershell
nslookup -type=TXT example.com
```

```powershell
nslookup -type=TXT _dmarc.example.com
```

Paste back the line(s) that start with `v=spf1` and `v=DMARC1`, in full. A long record can be split into several quoted pieces; paste all of them. If either one isn't there, say "none".

**D2. Gmail test.**
1. From an email address **on that domain**, send a short email to any Gmail address. Use the mailbox the business or the site already sends from.
2. In Gmail on a computer, open the email, click the three dots (More), and choose **"Show original"**.
3. Near the top are three lines for **SPF**, **DKIM** and **DMARC**, each saying PASS or FAIL. Paste just those three lines.
4. The IP address in the SPF line belongs to the mail server, not to you, so leave it as it is.
5. If there is no mailbox on that domain, write `skip D2: no mailbox on the domain`.

**Important rule for later (no action now):** if the email setup ever needs the host's mail server added, it gets **merged into the one existing `v=spf1` record**. A domain must never have two SPF records, because then every email fails. DKIM and DMARC work the same way: we add to what exists and never replace it.

## What to send back

Fill in this template and paste it into the chat. You can send it all at once or one part at a time. Use `skip <part>: <reason>` for anything you couldn't check.

```
A1 plan name: .NET Basic
A2 databases allowed / in use: 1 allowed, 1 in use.
A3 database size limit: 1000MB
A4 .NET versions offered: .net 10 and use .net 10
A5 live site and csptailoringdb in this same account (yes/no): yes
A6 how a site gets its settings: there is environment variable in the pool manager and there is web.config as well
A7 Web Deploy offered (yes/no): web deployed available as well as ftp 
A8 scheduled tasks offered (yes/no): no
A9 staging offered (yes/no): no

B1: Microsoft SQL Server 2022 (RTM-CUxx) (KBxxxxxxx) - 16.0.x (X64)   <build date>   Copyright (C) 2022 Microsoft Corporation  Web Edition (64-bit) on Windows Server 2022 Standard 10.0 <X64> (Build 20348: ) (Hypervisor) 
B2: 16.0.x
RTM	Web Edition (64-bit)
Web Edition (64-bit)
SQL_Latin1_General_CP1_CI_AS
B3: db_…_csptailoringdb	150	SQL_Latin1_General_CP1_CI_AS	0	SIMPLE
B4: 16.0
B5 IsDbOwner only: 1
B6: ADMINISTER DATABASE BULK OPERATIONS
ALTER
ALTER ANY APPLICATION ROLE
ALTER ANY ASSEMBLY
ALTER ANY ASYMMETRIC KEY
ALTER ANY CERTIFICATE
ALTER ANY COLUMN ENCRYPTION KEY
ALTER ANY COLUMN MASTER KEY
ALTER ANY CONTRACT
ALTER ANY DATABASE AUDIT
ALTER ANY DATABASE DDL TRIGGER
ALTER ANY DATABASE EVENT NOTIFICATION
ALTER ANY DATABASE EVENT SESSION
ALTER ANY DATABASE EVENT SESSION ADD EVENT
ALTER ANY DATABASE EVENT SESSION ADD TARGET
ALTER ANY DATABASE EVENT SESSION DISABLE
ALTER ANY DATABASE EVENT SESSION DROP EVENT
ALTER ANY DATABASE EVENT SESSION DROP TARGET
ALTER ANY DATABASE EVENT SESSION ENABLE
ALTER ANY DATABASE EVENT SESSION OPTION
ALTER ANY DATABASE SCOPED CONFIGURATION
ALTER ANY DATASPACE
ALTER ANY EXTERNAL DATA SOURCE
ALTER ANY EXTERNAL FILE FORMAT
ALTER ANY EXTERNAL JOB
ALTER ANY EXTERNAL LANGUAGE
ALTER ANY EXTERNAL LIBRARY
ALTER ANY EXTERNAL STREAM
ALTER ANY FULLTEXT CATALOG
ALTER ANY MASK
ALTER ANY MESSAGE TYPE
ALTER ANY REMOTE SERVICE BINDING
ALTER ANY ROLE
ALTER ANY ROUTE
ALTER ANY SCHEMA
ALTER ANY SECURITY POLICY
ALTER ANY SENSITIVITY CLASSIFICATION
ALTER ANY SERVICE
ALTER ANY SYMMETRIC KEY
ALTER ANY USER
ALTER LEDGER
ALTER LEDGER CONFIGURATION
AUTHENTICATE
BACKUP DATABASE
BACKUP LOG
CHECKPOINT
CONNECT
CONNECT REPLICATION
CONTROL
CREATE AGGREGATE
CREATE ANY DATABASE EVENT SESSION
CREATE ASSEMBLY
CREATE ASYMMETRIC KEY
CREATE CERTIFICATE
CREATE CONTRACT
CREATE DATABASE
CREATE DATABASE DDL EVENT NOTIFICATION
CREATE DEFAULT
CREATE EXTERNAL LANGUAGE
CREATE EXTERNAL LIBRARY
CREATE FULLTEXT CATALOG
CREATE FUNCTION
CREATE MESSAGE TYPE
CREATE PROCEDURE
CREATE QUEUE
CREATE REMOTE SERVICE BINDING
CREATE ROLE
CREATE ROUTE
CREATE RULE
CREATE SCHEMA
CREATE SERVICE
CREATE SYMMETRIC KEY
CREATE SYNONYM
CREATE TABLE
CREATE TYPE
CREATE USER
CREATE VIEW
CREATE XML SCHEMA COLLECTION
DELETE
DROP ANY DATABASE EVENT SESSION
ENABLE LEDGER
EXECUTE
EXECUTE ANY EXTERNAL ENDPOINT
EXECUTE ANY EXTERNAL SCRIPT
INSERT
KILL DATABASE CONNECTION
REFERENCES
SELECT
SHOWPLAN
SUBSCRIBE QUERY NOTIFICATIONS
TAKE OWNERSHIP
UNMASK
UPDATE
VIEW ANY COLUMN ENCRYPTION KEY DEFINITION
VIEW ANY COLUMN MASTER KEY DEFINITION
VIEW ANY SENSITIVITY CLASSIFICATION
VIEW CRYPTOGRAPHICALLY SECURED DEFINITION
VIEW DATABASE PERFORMANCE STATE
VIEW DATABASE SECURITY AUDIT
VIEW DATABASE SECURITY STATE
VIEW DATABASE STATE
VIEW DEFINITION
VIEW LEDGER CONTENT
VIEW PERFORMANCE DEFINITION
VIEW SECURITY DEFINITION

C probe result: (paste the { ... } block, last number of your IP replaced with x)
C status line: HTTP ___
C probe site deleted: yes. The second run showed: ___

D domain:
D1 SPF line:
D1 DMARC line:
D2 SPF:
D2 DKIM:
D2 DMARC:
```

**Never include:** passwords, database login names (the `DbUser` value), connection strings, the probe key, or the last number of your own IP address.

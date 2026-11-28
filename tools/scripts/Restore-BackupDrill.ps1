<#
.SYNOPSIS
    Restores a production backup (.bak) into CSPS_RestoreDrill on (localdb)\MSSQLLocalDB, checks it, and writes a
    metadata-only receipt (14 D-07, D-40). -Drop removes the drill copy again.

.DESCRIPTION
    The restore drill proves that a hosting backup can really be restored. It restores the backup on this PC,
    checks it, compares what it holds with the numbers the live admin showed at backup time, and records the result
    without copying any of the data.

    Safety rules:
      - The .bak must be inside this project's _local folder and must end in .bak. Anything else is refused before
        any connection is opened. The .bak never leaves _local (it is git-ignored and is never uploaded).
      - It connects ONLY to (localdb)\MSSQLLocalDB and restores ONLY into CSPS_RestoreDrill. Both are fixed in the
        script. They are not parameters, so a typo cannot point it at any other database, including the databases
        of the other project that shares this instance.
      - Nothing but CSPS_RestoreDrill is ever dropped. If it already exists, the script stops. -Replace drops that
        exact name and restores again, but only after the new .bak has been read (RESTORE FILELISTONLY) and
        verified (RESTORE VERIFYONLY), so a bad file never costs the copy already there. -Drop drops that exact
        name and does nothing else.
      - After the restore it runs DBCC CHECKDB on the copy.
      - The receipt reads catalog views (sys.tables, sys.schemas, sys.partitions) and, from the migration history
        table, the latest migration id. It never reads a row of any other user table, so no production value can
        reach the receipt, git or chat.
      - The receipt holds the .bak file name (not its folder), size, SHA-256, times, the check results, the server
        version, table names with row counts, and a Match or Mismatch line for each number you pass in. It is
        written to the git-ignored _local folder and never committed. A -ReceiptPath inside the repository but
        outside _local is refused.
      - The copy still holds the real email outbox. Never start the app against it with working mail settings or the
        production certificate. See docs/operations/backup-restore.md.

    Exit codes: 0 when every check passed and every number given matched, 1 when the script refused or stopped,
    3 when the restore finished but a check failed or a number did not match (the receipt says which).

    Compatible with Windows PowerShell 5.1 (uses System.Data.SqlClient from the .NET Framework).

.PARAMETER BakPath
    The .bak file, inside the project's _local folder. A relative path is taken from the current folder.

.PARAMETER Replace
    Drop an existing CSPS_RestoreDrill first, then restore.

.PARAMETER Drop
    Drop CSPS_RestoreDrill and stop. Does not need a .bak.

.PARAMETER ReceiptPath
    Where to write the Markdown receipt. Default: _local\restore-drill-receipt.md (git-ignored).

.PARAMETER ExpectedOrders
    The Orders count the live admin showed at backup time.

.PARAMETER ExpectedUsers
    The Users count the live admin showed at backup time.

.PARAMETER ExpectedQuoteRequests
    The Quote Requests count the live admin showed at backup time.

.PARAMETER ExpectedMigration
    The last migration of the deployed release: the full id, or just the name after the date and underscore.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Restore-BackupDrill.ps1 -BakPath _local\drill.bak -ExpectedOrders 120 -ExpectedUsers 4 -ExpectedQuoteRequests 35 -ExpectedMigration ExampleMigrationName

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Restore-BackupDrill.ps1 -Drop
#>
[CmdletBinding(DefaultParameterSetName = 'Restore')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Restore')]
    [string]$BakPath,

    [Parameter(ParameterSetName = 'Restore')]
    [switch]$Replace,

    [Parameter(Mandatory = $true, ParameterSetName = 'Drop')]
    [switch]$Drop,

    [Parameter(ParameterSetName = 'Restore')]
    [string]$ReceiptPath,

    [Parameter(ParameterSetName = 'Restore')]
    [ValidateRange(0, 2147483647)]
    [int]$ExpectedOrders,

    [Parameter(ParameterSetName = 'Restore')]
    [ValidateRange(0, 2147483647)]
    [int]$ExpectedUsers,

    [Parameter(ParameterSetName = 'Restore')]
    [ValidateRange(0, 2147483647)]
    [int]$ExpectedQuoteRequests,

    [Parameter(ParameterSetName = 'Restore')]
    [string]$ExpectedMigration
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# The only server and database this script ever uses (14 D-07).
$connectionString = 'Server=(localdb)\MSSQLLocalDB;Database=master;Integrated Security=true'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Stop-Script([string]$message) {
    [Console]::Error.WriteLine($message)
    exit 1
}

function Get-FullPath([string]$path) {
    if (-not [System.IO.Path]::IsPathRooted($path)) {
        $path = Join-Path (Get-Location).ProviderPath $path
    }
    return [System.IO.Path]::GetFullPath($path)
}

function Resolve-LocalBak([string]$path) {
    $localRoot = Get-FullPath (Join-Path $repoRoot '_local')
    $full = Get-FullPath $path

    if (-not $full.EndsWith('.bak', [System.StringComparison]::OrdinalIgnoreCase)) {
        Stop-Script 'Refusing to run: -BakPath must be a file that ends in .bak.'
    }
    if (-not $full.StartsWith($localRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        Stop-Script "Refusing to run: the .bak must be inside this project's _local folder."
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        Stop-Script 'Refusing to run: the .bak file was not found.'
    }
    # A link inside _local could point anywhere, so a linked file is refused, and so is a link on any folder between the file and _local.
    $item = Get-Item -LiteralPath $full -Force
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        Stop-Script 'Refusing to run: the .bak must not be a link.'
    }
    $dir = Split-Path -Parent $full
    while ($dir.Length -ge $localRoot.Length) {
        if ((Get-Item -LiteralPath $dir -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            Stop-Script 'Refusing to run: no folder on the way to the .bak, including _local, may be a link.'
        }
        $dir = Split-Path -Parent $dir
    }
    return $full
}

function ConvertTo-FileSafeName([string]$name) {
    return ($name -replace '[^A-Za-z0-9_-]', '_')
}

function ConvertTo-SqlLiteral([string]$value) {
    return "N'" + $value.Replace("'", "''") + "'"
}

# Every refusal that depends only on the arguments happens here, before any connection is opened.
$bakFull = $null
$receiptFull = $null
if (-not $Drop) {
    $bakFull = Resolve-LocalBak $BakPath
    if ([string]::IsNullOrWhiteSpace($ReceiptPath)) {
        $ReceiptPath = Join-Path $repoRoot '_local\restore-drill-receipt.md'
    }
    $receiptFull = Get-FullPath $ReceiptPath
    if (-not $receiptFull.EndsWith('.md', [System.StringComparison]::OrdinalIgnoreCase)) {
        Stop-Script 'Refusing to run: -ReceiptPath must end in .md.'
    }
    $repoFull = Get-FullPath $repoRoot
    $localFull = Get-FullPath (Join-Path $repoRoot '_local')
    if ($receiptFull.StartsWith($repoFull + '\', [System.StringComparison]::OrdinalIgnoreCase) -and
        -not $receiptFull.StartsWith($localFull + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        Stop-Script "Refusing to run: -ReceiptPath must be inside this project's _local folder when it is inside the repository (the receipt lists production table names and is never committed)."
    }
}

Add-Type -AssemblyName System.Data
$connection = New-Object System.Data.SqlClient.SqlConnection $connectionString
$bakFile = $null
$sha256 = $null
$restoredAt = $null
$serverVersion = $null
$compatibility = $null
$checkDbResult = $null
$latestMigration = $null
$readProblems = New-Object System.Collections.Generic.List[string]
$tables = New-Object System.Collections.Generic.List[object]
try {
    if (-not $Drop) {
        $bakFile = Get-Item -LiteralPath $bakFull
        Write-Host "Hashing $($bakFile.Name) ($([math]::Round($bakFile.Length / 1MB, 1)) MB)..."
        $sha256 = (Get-FileHash -LiteralPath $bakFull -Algorithm SHA256).Hash.ToLowerInvariant()
    }

    $connection.Open()

    $exists = $connection.CreateCommand()
    $exists.CommandText = 'SELECT COUNT(*) FROM master.sys.databases WHERE name = N''CSPS_RestoreDrill'';'
    $present = ([int]$exists.ExecuteScalar()) -gt 0

    if ($Drop -and -not $present) {
        Write-Host 'CSPS_RestoreDrill is not on (localdb)\MSSQLLocalDB. Nothing to drop.'
        exit 0
    }
    if ($present -and -not $Replace -and -not $Drop) {
        Stop-Script 'CSPS_RestoreDrill already exists on (localdb)\MSSQLLocalDB. Nothing was changed. Use -Replace to drop it and restore again, or -Drop to remove it.'
    }

    if (-not $Drop) {
        # The backup's file list says which files to restore and where to put them.
        $list = $connection.CreateCommand()
        $list.CommandText = 'RESTORE FILELISTONLY FROM DISK = @path;'
        $list.CommandTimeout = 0
        [void]$list.Parameters.AddWithValue('@path', $bakFull)
        $files = New-Object System.Collections.Generic.List[object]
        $reader = $list.ExecuteReader()
        try {
            $nameColumn = $reader.GetOrdinal('LogicalName')
            $typeColumn = $reader.GetOrdinal('Type')
            while ($reader.Read()) {
                $files.Add([pscustomobject]@{ Logical = $reader.GetString($nameColumn); Type = $reader.GetString($typeColumn) })
            }
        }
        finally {
            $reader.Dispose()
        }
        if ($files.Count -eq 0) {
            Stop-Script 'The backup lists no files to restore.'
        }
        if (@($files | Where-Object { $_.Type -ne 'D' -and $_.Type -ne 'L' }).Count -gt 0) {
            Stop-Script 'The backup holds a file type this script does not restore (only data and log files).'
        }

        $folderQuery = $connection.CreateCommand()
        $folderQuery.CommandText = 'SELECT CONVERT(nvarchar(4000), SERVERPROPERTY(''InstanceDefaultDataPath''));'
        $dataFolder = $folderQuery.ExecuteScalar()
        if ($dataFolder -is [System.DBNull] -or [string]::IsNullOrWhiteSpace([string]$dataFolder)) {
            $fallback = $connection.CreateCommand()
            $fallback.CommandText = 'SELECT physical_name FROM master.sys.master_files WHERE database_id = 1 AND file_id = 1;'
            $dataFolder = Split-Path -Parent ([string]$fallback.ExecuteScalar())
        }
        $dataFolder = ([string]$dataFolder).TrimEnd('\')

        $moves = New-Object System.Collections.Generic.List[string]
        $dataIndex = 0
        foreach ($file in $files) {
            $safe = ConvertTo-FileSafeName $file.Logical
            if ($file.Type -eq 'L') {
                $extension = 'ldf'
            }
            elseif ($dataIndex -eq 0) {
                $extension = 'mdf'
                $dataIndex++
            }
            else {
                $extension = 'ndf'
                $dataIndex++
            }
            $target = "$dataFolder\CSPS_RestoreDrill_$safe.$extension"
            $moves.Add('MOVE ' + (ConvertTo-SqlLiteral $file.Logical) + ' TO ' + (ConvertTo-SqlLiteral $target))
        }

        # The backup must be readable and intact before anything is dropped.
        Write-Host 'Verifying the backup...'
        $verify = $connection.CreateCommand()
        $verify.CommandText = 'RESTORE VERIFYONLY FROM DISK = @path;'
        $verify.CommandTimeout = 0
        [void]$verify.Parameters.AddWithValue('@path', $bakFull)
        try {
            [void]$verify.ExecuteNonQuery()
        }
        catch {
            Stop-Script 'The backup failed RESTORE VERIFYONLY, so it is not usable. Nothing was dropped or changed.'
        }
    }

    if ($present) {
        $drop = $connection.CreateCommand()
        $drop.CommandText = 'ALTER DATABASE [CSPS_RestoreDrill] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [CSPS_RestoreDrill];'
        [void]$drop.ExecuteNonQuery()
        Write-Host 'Dropped CSPS_RestoreDrill.'
    }
    if ($Drop) {
        exit 0
    }

    Write-Host 'Restoring into CSPS_RestoreDrill on (localdb)\MSSQLLocalDB...'
    $restore = $connection.CreateCommand()
    $restore.CommandText = 'RESTORE DATABASE [CSPS_RestoreDrill] FROM DISK = @path WITH ' + ($moves -join ', ') + ', RECOVERY;'
    $restore.CommandTimeout = 0
    [void]$restore.Parameters.AddWithValue('@path', $bakFull)
    [void]$restore.ExecuteNonQuery()
    $restoredAt = Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'

    # A full consistency check of the restored copy.
    Write-Host 'Running DBCC CHECKDB...'
    $check = $connection.CreateCommand()
    $check.CommandText = 'DBCC CHECKDB (N''CSPS_RestoreDrill'') WITH NO_INFOMSGS, ALL_ERRORMSGS;'
    $check.CommandTimeout = 0
    try {
        [void]$check.ExecuteNonQuery()
        $checkDbResult = 'Passed'
    }
    catch {
        $checkDbResult = 'Failed'
        # The text is metadata only (object and page ids). It goes to the console, never to the receipt.
        [Console]::Error.WriteLine('DBCC CHECKDB reported: ' + $_.Exception.Message)
    }

    # A read that fails after the restore must not lose the receipt: it is noted and the script goes on.
    $info = $connection.CreateCommand()
    $info.CommandText = 'SELECT CONVERT(nvarchar(64), SERVERPROPERTY(''ProductVersion'')), compatibility_level FROM master.sys.databases WHERE name = N''CSPS_RestoreDrill'';'
    try {
        $reader = $info.ExecuteReader()
        try {
            if ($reader.Read()) {
                $serverVersion = $reader.GetString(0)
                $compatibility = [int]$reader.GetByte(1)
            }
        }
        finally {
            $reader.Dispose()
        }
    }
    catch {
        $readProblems.Add('server version')
        [Console]::Error.WriteLine('Could not read the server version: ' + $_.Exception.Message)
    }

    # Names and counts from catalog views only. No other user table is ever read.
    $counts = $connection.CreateCommand()
    $counts.CommandText = @"
SELECT s.name AS SchemaName, t.name AS TableName, SUM(p.rows) AS RowCountTotal
FROM [CSPS_RestoreDrill].sys.tables AS t
JOIN [CSPS_RestoreDrill].sys.schemas AS s ON s.schema_id = t.schema_id
JOIN [CSPS_RestoreDrill].sys.partitions AS p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
GROUP BY s.name, t.name
ORDER BY s.name, t.name;
"@
    $counts.CommandTimeout = 0
    try {
        $reader = $counts.ExecuteReader()
        try {
            while ($reader.Read()) {
                $tables.Add([pscustomobject]@{
                        Name = $reader.GetString(0) + '.' + $reader.GetString(1)
                        Rows = [int64]$reader.GetInt64(2)
                    })
            }
        }
        finally {
            $reader.Dispose()
        }
    }
    catch {
        $readProblems.Add('table row counts')
        [Console]::Error.WriteLine('Could not read the table row counts: ' + $_.Exception.Message)
    }

    # The one user table that is read: the id of the latest applied migration.
    # A backup with no migration history table (for example the old legacy database) lands in the catch.
    $migration = $connection.CreateCommand()
    $migration.CommandText = @"
SELECT TOP (1) [MigrationId]
FROM [CSPS_RestoreDrill].[dbo].[__EFMigrationsHistory]
ORDER BY [MigrationId] DESC;
"@
    try {
        $latest = $migration.ExecuteScalar()
        if ($null -ne $latest -and -not ($latest -is [System.DBNull])) {
            $latestMigration = [string]$latest
        }
    }
    catch {
        $readProblems.Add('latest migration id')
        [Console]::Error.WriteLine('Could not read the latest migration id: ' + $_.Exception.Message)
    }
}
finally {
    $connection.Dispose()
}

$culture = [System.Globalization.CultureInfo]::InvariantCulture
$totalRows = [int64]0
foreach ($table in $tables) { $totalRows += $table.Rows }

# Each number the owner passed in is compared with what the copy holds (14 D-40).
$comparisons = New-Object System.Collections.Generic.List[object]
$needsAttention = ($checkDbResult -ne 'Passed') -or ($readProblems.Count -gt 0)

function Get-TableRows([string]$name) {
    $match = $tables | Where-Object { $_.Name -eq $name } | Select-Object -First 1
    if ($null -eq $match) { return $null }
    return $match.Rows
}

function New-CountComparison([string]$label, [bool]$given, [int64]$expected, [string]$table) {
    $found = Get-TableRows $table
    $foundText = if ($null -eq $found) { 'Table not found' } else { $found.ToString('N0', $culture) }
    if (-not $given) {
        return [pscustomobject]@{ Label = $label; Expected = 'Not given'; Found = $foundText; Result = 'Not compared' }
    }
    $result = if ($null -ne $found -and $found -eq $expected) { 'Match' } else { 'Mismatch' }
    return [pscustomobject]@{ Label = $label; Expected = $expected.ToString('N0', $culture); Found = $foundText; Result = $result }
}

$comparisons.Add((New-CountComparison 'Orders' ($PSBoundParameters.ContainsKey('ExpectedOrders')) $ExpectedOrders 'dbo.Orders'))
$comparisons.Add((New-CountComparison 'Users' ($PSBoundParameters.ContainsKey('ExpectedUsers')) $ExpectedUsers 'dbo.AspNetUsers'))
$comparisons.Add((New-CountComparison 'Quote Requests' ($PSBoundParameters.ContainsKey('ExpectedQuoteRequests')) $ExpectedQuoteRequests 'dbo.QuoteRequests'))

$migrationFound = if ($null -eq $latestMigration) { 'No migration found' } else { $latestMigration }
if ($PSBoundParameters.ContainsKey('ExpectedMigration')) {
    $underscore = if ($null -eq $latestMigration) { -1 } else { $latestMigration.IndexOf('_') }
    $migrationName = if ($underscore -ge 0) { $latestMigration.Substring($underscore + 1) } else { $latestMigration }
    $migrationMatch = ($null -ne $latestMigration) -and
        (($latestMigration -ceq $ExpectedMigration) -or ($migrationName -ceq $ExpectedMigration))
    $migrationResult = if ($migrationMatch) { 'Match' } else { 'Mismatch' }
    $comparisons.Add([pscustomobject]@{ Label = 'Last migration'; Expected = $ExpectedMigration; Found = $migrationFound; Result = $migrationResult })
}
else {
    $comparisons.Add([pscustomobject]@{ Label = 'Last migration'; Expected = 'Not given'; Found = $migrationFound; Result = 'Not compared' })
}
if (@($comparisons | Where-Object { $_.Result -eq 'Mismatch' }).Count -gt 0) { $needsAttention = $true }

$now = Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'
$created = $now
if (Test-Path -LiteralPath $receiptFull -PathType Leaf) {
    $old = [regex]::Match((Get-Content -LiteralPath $receiptFull -Raw), '\*Created: (?<created>\S+)')
    if ($old.Success) { $created = $old.Groups['created'].Value }
}

$overall = if ($needsAttention) { 'Needs attention' } else { 'All checks passed' }
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Backup restore drill receipt')
$lines.Add('')
$lines.Add("*Created: $created $([char]0x00B7) Updated: $now*")
$lines.Add('')
$lines.Add('Metadata only. No data value from the backup is in this file (14 D-07, D-40).')
$lines.Add('')
$lines.Add('| Item | Value |')
$lines.Add('|---|---|')
$lines.Add('| .bak file name | ' + $bakFile.Name + ' |')
$lines.Add('| .bak size (bytes) | ' + $bakFile.Length.ToString('N0', $culture) + ' |')
$lines.Add('| .bak SHA-256 | ' + $sha256 + ' |')
$lines.Add('| Restored at | ' + $restoredAt + ' |')
$lines.Add('| Restored into | CSPS_RestoreDrill on (localdb)\MSSQLLocalDB |')
$lines.Add('| Local server version | ' + $serverVersion + ' |')
$lines.Add('| Copy compatibility level | ' + $compatibility + ' |')
$lines.Add('| RESTORE VERIFYONLY | Passed (a failure stops the script before anything changes) |')
$lines.Add('| DBCC CHECKDB | ' + $checkDbResult + ' |')
$readsResult = if ($readProblems.Count -gt 0) { 'Failed: ' + ($readProblems -join ', ') + ' (see the console)' } else { 'All read' }
$lines.Add('| Reads after the restore | ' + $readsResult + ' |')
$lines.Add('| Tables | ' + $tables.Count.ToString($culture) + ' |')
$lines.Add('| Total rows | ' + $totalRows.ToString('N0', $culture) + ' |')
$lines.Add('| Overall | ' + $overall + ' |')
$lines.Add('')
$lines.Add('## Compared with the live admin at backup time')
$lines.Add('')
$lines.Add('| Item | Expected | Found | Result |')
$lines.Add('|---|---:|---:|---|')
foreach ($comparison in $comparisons) {
    $lines.Add('| ' + $comparison.Label + ' | ' + $comparison.Expected + ' | ' + $comparison.Found + ' | ' + $comparison.Result + ' |')
}
$lines.Add('')
$lines.Add('## Tables')
$lines.Add('')
$lines.Add('| Schema.Table | Rows |')
$lines.Add('|---|---:|')
foreach ($table in $tables) {
    $lines.Add('| ' + $table.Name.Replace('|', '\|') + ' | ' + $table.Rows.ToString('N0', $culture) + ' |')
}

$receiptFolder = Split-Path -Parent $receiptFull
if (-not (Test-Path -LiteralPath $receiptFolder -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $receiptFolder)
}
[System.IO.File]::WriteAllText($receiptFull, ($lines -join "`r`n") + "`r`n", (New-Object System.Text.UTF8Encoding($false)))

Write-Host ''
Write-Host "Restored $($bakFile.Name) into CSPS_RestoreDrill."
Write-Host "DBCC CHECKDB: $checkDbResult."
foreach ($comparison in $comparisons) {
    Write-Host "$($comparison.Label): $($comparison.Result)"
}
Write-Host "Tables: $($tables.Count). Total rows: $($totalRows.ToString('N0', $culture))."
Write-Host "SHA-256: $sha256"
Write-Host "Receipt: $receiptFull"
Write-Host "Overall: $overall"
Write-Host 'Drop the copy when you are done: Restore-BackupDrill.ps1 -Drop'

if ($needsAttention) {
    exit 3
}

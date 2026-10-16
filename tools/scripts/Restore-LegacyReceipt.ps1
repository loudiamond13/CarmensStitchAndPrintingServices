<#
.SYNOPSIS
    Restores the legacy .bak into CSPS_Legacy_Restore on (localdb)\MSSQLLocalDB and writes a receipt of table names
    and row counts (D-04).

.DESCRIPTION
    The cutover proves the legacy backup by restoring it on this machine before the host database is deleted. The
    receipt records what the backup holds without copying any of it: table names and row counts only.

    Safety rules:
      - The .bak must be inside this project's _local folder and must end in .bak. Anything else is refused before
        any connection is opened. The .bak never leaves _local (it is git-ignored and is never uploaded).
      - It connects ONLY to (localdb)\MSSQLLocalDB and restores ONLY into CSPS_Legacy_Restore. Both are fixed in the
        script. They are not parameters, so a typo cannot point it at CSPS_Dev, CSPS_E2E or a BetsLLC_* database,
        which TheBETSLLC shares this instance with.
      - If CSPS_Legacy_Restore already exists, it stops. -Replace drops that exact name and restores again, but only
        after the new .bak has been read (RESTORE FILELISTONLY) and verified (RESTORE VERIFYONLY, which checks the
        backup checksums when the backup has them), so a bad file never costs the restore already there. Nothing else
        is ever dropped.
      - The receipt query reads catalog views only (sys.tables, sys.schemas, sys.partitions). It never reads a row
        of any user table, so no legacy value can reach the receipt, git or chat.
      - The receipt holds the .bak file name (not its folder), size, SHA-256, restore time, table count, total rows
        and one row count per table. Those are production table names and volumes, so the receipt is written to the
        git-ignored _local folder and never committed. A -ReceiptPath inside the repository but outside _local is
        refused.

    Compatible with Windows PowerShell 5.1 (uses System.Data.SqlClient from the .NET Framework).

.PARAMETER BakPath
    The .bak file, inside the project's _local folder. A relative path is taken from the current folder.

.PARAMETER Replace
    Drop an existing CSPS_Legacy_Restore first, then restore.

.PARAMETER ReceiptPath
    Where to write the Markdown receipt. Default: _local\legacy-receipt.md (git-ignored).

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Restore-LegacyReceipt.ps1 -BakPath _local\legacy.bak

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Restore-LegacyReceipt.ps1 -BakPath _local\legacy.bak -Replace
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BakPath,

    [switch]$Replace,

    [string]$ReceiptPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# The only server and database this script ever uses (D-04).
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
    # A link inside _local could point anywhere, so a linked file or folder is refused.
    $item = Get-Item -LiteralPath $full -Force
    $folder = Get-Item -LiteralPath $localRoot -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -or ($folder.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        Stop-Script 'Refusing to run: the .bak and the _local folder must not be links.'
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
$bakFull = Resolve-LocalBak $BakPath
if ([string]::IsNullOrWhiteSpace($ReceiptPath)) {
    $ReceiptPath = Join-Path $repoRoot '_local\legacy-receipt.md'
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

Add-Type -AssemblyName System.Data
$connection = New-Object System.Data.SqlClient.SqlConnection $connectionString
try {
    $bakFile = Get-Item -LiteralPath $bakFull
    Write-Host "Hashing $($bakFile.Name) ($([math]::Round($bakFile.Length / 1MB, 1)) MB)..."
    $sha256 = (Get-FileHash -LiteralPath $bakFull -Algorithm SHA256).Hash.ToLowerInvariant()

    $connection.Open()

    $exists = $connection.CreateCommand()
    $exists.CommandText = 'SELECT COUNT(*) FROM master.sys.databases WHERE name = N''CSPS_Legacy_Restore'';'
    $present = ([int]$exists.ExecuteScalar()) -gt 0

    if ($present -and -not $Replace) {
        Stop-Script 'CSPS_Legacy_Restore already exists on (localdb)\MSSQLLocalDB. Nothing was changed. Use -Replace to drop it and restore again.'
    }
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
        $target = "$dataFolder\CSPS_Legacy_Restore_$safe.$extension"
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

    if ($present) {
        $drop = $connection.CreateCommand()
        $drop.CommandText = 'ALTER DATABASE [CSPS_Legacy_Restore] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [CSPS_Legacy_Restore];'
        [void]$drop.ExecuteNonQuery()
        Write-Host 'Dropped the existing CSPS_Legacy_Restore.'
    }

    Write-Host 'Restoring into CSPS_Legacy_Restore on (localdb)\MSSQLLocalDB...'
    $restore = $connection.CreateCommand()
    $restore.CommandText = 'RESTORE DATABASE [CSPS_Legacy_Restore] FROM DISK = @path WITH ' + ($moves -join ', ') + ', RECOVERY;'
    $restore.CommandTimeout = 0
    [void]$restore.Parameters.AddWithValue('@path', $bakFull)
    [void]$restore.ExecuteNonQuery()
    $restoredAt = Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'

    # Names and counts from catalog views only. No user table is ever read.
    $counts = $connection.CreateCommand()
    $counts.CommandText = @"
SELECT s.name AS SchemaName, t.name AS TableName, SUM(p.rows) AS RowCountTotal
FROM [CSPS_Legacy_Restore].sys.tables AS t
JOIN [CSPS_Legacy_Restore].sys.schemas AS s ON s.schema_id = t.schema_id
JOIN [CSPS_Legacy_Restore].sys.partitions AS p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
GROUP BY s.name, t.name
ORDER BY s.name, t.name;
"@
    $counts.CommandTimeout = 0
    $tables = New-Object System.Collections.Generic.List[object]
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
finally {
    $connection.Dispose()
}

$totalRows = [int64]0
foreach ($table in $tables) { $totalRows += $table.Rows }

$now = Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'
$created = $now
if (Test-Path -LiteralPath $receiptFull -PathType Leaf) {
    $old = [regex]::Match((Get-Content -LiteralPath $receiptFull -Raw), '\*Created: (?<created>\S+)')
    if ($old.Success) { $created = $old.Groups['created'].Value }
}

$culture = [System.Globalization.CultureInfo]::InvariantCulture
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# Legacy database restore receipt')
$lines.Add('')
$lines.Add("*Created: $created $([char]0x00B7) Updated: $now*")
$lines.Add('')
$lines.Add('Table names and row counts only. No data value from the legacy database is in this file (D-04).')
$lines.Add('')
$lines.Add('| Item | Value |')
$lines.Add('|---|---|')
$lines.Add('| .bak file name | ' + $bakFile.Name + ' |')
$lines.Add('| .bak size (bytes) | ' + $bakFile.Length.ToString('N0', $culture) + ' |')
$lines.Add('| .bak SHA-256 | ' + $sha256 + ' |')
$lines.Add('| Restored at | ' + $restoredAt + ' |')
$lines.Add('| Restored into | CSPS_Legacy_Restore on (localdb)\MSSQLLocalDB |')
$lines.Add('| Tables | ' + $tables.Count.ToString($culture) + ' |')
$lines.Add('| Total rows | ' + $totalRows.ToString('N0', $culture) + ' |')
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
Write-Host "Restored $($bakFile.Name) into CSPS_Legacy_Restore."
Write-Host "Tables: $($tables.Count). Total rows: $($totalRows.ToString('N0', $culture))."
Write-Host "SHA-256: $sha256"
Write-Host "Receipt: $receiptFull"

<#
.SYNOPSIS
    Creates (when missing) and starts the default LocalDB instance, (localdb)\MSSQLLocalDB.

.DESCRIPTION
    CSPS uses the default MSSQLLocalDB instance, which it shares with TheBETSLLC. CSPS touches only its
    own CSPS_* databases on it. This script never stops, deletes or recreates the instance.

    Safe to run any number of times:
      - instance missing  -> sqllocaldb create MSSQLLocalDB -s  (create and start)
      - instance present  -> sqllocaldb start MSSQLLocalDB      (a no-op when it is already running)

    LocalDB talks over named pipes, so no TCP port is opened. Compatible with Windows PowerShell 5.1.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-LocalDb.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$instanceName = 'MSSQLLocalDB'

if (-not (Get-Command -Name 'sqllocaldb' -ErrorAction SilentlyContinue)) {
    throw 'sqllocaldb was not found. Install SQL Server Express LocalDB (free), then run this script again.'
}

# "sqllocaldb info" with no argument lists one instance name per line.
$existing = @(& sqllocaldb info | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
if ($LASTEXITCODE -ne 0) {
    throw "sqllocaldb info failed with exit code $LASTEXITCODE."
}

if ($existing -contains $instanceName) {
    Write-Host "LocalDB instance '$instanceName' exists. Starting it (no-op when already running)."
    & sqllocaldb start $instanceName
    if ($LASTEXITCODE -ne 0) {
        throw "sqllocaldb start $instanceName failed with exit code $LASTEXITCODE."
    }
}
else {
    Write-Host "LocalDB instance '$instanceName' not found. Creating and starting it."
    & sqllocaldb create $instanceName -s
    if ($LASTEXITCODE -ne 0) {
        throw "sqllocaldb create $instanceName failed with exit code $LASTEXITCODE."
    }
}

& sqllocaldb info $instanceName
if ($LASTEXITCODE -ne 0) {
    throw "sqllocaldb info $instanceName failed with exit code $LASTEXITCODE."
}

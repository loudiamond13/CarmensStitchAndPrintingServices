<#
.SYNOPSIS
    Drops leftover CSPS test databases (CSPS_Test_<guid>) from the dedicated (localdb)\CSPS instance.

.DESCRIPTION
    Test fixtures drop their own databases on dispose. A crashed or killed test run can leave some behind;
    this script removes them (FND-11, D-05, T-01-15).

    Safety rules:
      - It connects ONLY to (localdb)\CSPS. It never connects to the shared MSSQLLocalDB instance, which
        belongs to another project on this machine.
      - It drops ONLY names matching ^CSPS_Test_[0-9a-f-]{36}$ exactly (checked here in PowerShell, not only
        with SQL LIKE). CSPS_Dev, CSPS_E2E, CSPS_Legacy_Restore and every other database are never touched.
      - It drops ONLY databases older than -OlderThanMinutes (default 120), so a database that a test run is
        using right now is left alone.
      - -WhatIf lists what would be dropped without dropping anything.

    Compatible with Windows PowerShell 5.1 (uses System.Data.SqlClient from the .NET Framework).

.PARAMETER OlderThanMinutes
    Minimum age, from the database's create_date, before a test database may be dropped. Default 120.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Remove-StaleTestDatabases.ps1 -WhatIf

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Remove-StaleTestDatabases.ps1 -OlderThanMinutes 30
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateRange(1, 525600)]
    [int]$OlderThanMinutes = 120
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# The only server this script ever talks to (D-05).
$connectionString = 'Server=(localdb)\CSPS;Database=master;Integrated Security=true'
$namePattern = '^CSPS_Test_[0-9a-f-]{36}$'
$nameLength = 46

if ($connectionString -match 'MSSQLLocalDB') {
    throw 'Refusing to run: the connection string names the shared MSSQLLocalDB instance.'
}

function Test-DisposableName([string]$name) {
    # -cmatch: case-sensitive, like the test fixture's guard. The length check stops a trailing newline slipping past $.
    return ($name -cmatch $namePattern) -and ($name.Length -eq $nameLength)
}

Add-Type -AssemblyName System.Data
$connection = New-Object System.Data.SqlClient.SqlConnection $connectionString
try {
    $connection.Open()

    $query = $connection.CreateCommand()
    $query.CommandText = @"
SELECT name, create_date
FROM sys.databases
WHERE name LIKE N'CSPS[_]Test[_]%' AND create_date < DATEADD(MINUTE, -@olderThan, GETDATE())
ORDER BY name;
"@
    [void]$query.Parameters.AddWithValue('@olderThan', $OlderThanMinutes)

    $candidates = New-Object System.Collections.Generic.List[string]
    $reader = $query.ExecuteReader()
    try {
        while ($reader.Read()) {
            $name = $reader.GetString(0)
            if (Test-DisposableName $name) {
                $candidates.Add($name)
            }
        }
    }
    finally {
        $reader.Dispose()
    }

    if ($candidates.Count -eq 0) {
        Write-Host "No CSPS_Test_ databases older than $OlderThanMinutes minutes on (localdb)\CSPS."
        return
    }

    foreach ($name in $candidates) {
        # Re-check right before the DDL: only a validated name is ever spliced into SQL (CWE-89).
        if (-not (Test-DisposableName $name)) {
            throw "Refusing to drop '$name': it does not match $namePattern."
        }

        if ($PSCmdlet.ShouldProcess("(localdb)\CSPS", "Drop database $name")) {
            $drop = $connection.CreateCommand()
            $drop.CommandText = "ALTER DATABASE [$name] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$name];"
            [void]$drop.ExecuteNonQuery()
            Write-Host "Dropped $name"
        }
    }
}
finally {
    $connection.Dispose()
}

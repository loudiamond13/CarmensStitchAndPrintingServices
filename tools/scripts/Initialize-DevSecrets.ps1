<#
.SYNOPSIS
    Creates the local development secrets of src/Csps.Server in dotnet user-secrets (D-15, T-01-31).

.DESCRIPTION
    Safe to run any number of times. Each secret is created only when it is missing; an existing value is
    never changed, because replacing it would sign out every local session that used the old value.

      - Jwt:SigningKey  48 random bytes from RandomNumberGenerator, base64-encoded (HS256 needs at least 32).

    The values are written only to this user's user-secrets file for the project's UserSecretsId
    (%APPDATA%\Microsoft\UserSecrets\<id>\secrets.json). Nothing goes into git, into environment variables or
    into machine settings, and no secret value is ever printed. Plan 10 adds the Data Protection certificate.

    Production never uses user-secrets: the host settings supply Jwt:SigningKey there.
    Compatible with Windows PowerShell 5.1.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-DevSecrets.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$project = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'src\Csps.Server\Csps.Server.csproj'
if (-not (Test-Path -LiteralPath $project)) {
    throw "Project not found: $project"
}

if (-not (Get-Command -Name 'dotnet' -ErrorAction SilentlyContinue)) {
    throw 'dotnet was not found. Install the .NET SDK pinned in global.json, then run this script again.'
}

# Returns the names of the secrets that already exist. "dotnet user-secrets list" prints "Name = value" lines;
# only the part before " = " is kept, so the values never leave this function.
function Get-SecretNames {
    $lines = @(& dotnet user-secrets list --project $project 2>$null)
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet user-secrets list failed with exit code $LASTEXITCODE."
    }

    return @($lines | Where-Object { $_ -match ' = ' } | ForEach-Object { ($_ -split ' = ', 2)[0].Trim() })
}

# Stores one secret. "dotnet user-secrets set" echoes the value, so its output is discarded.
function Set-Secret([string] $name, [string] $value) {
    & dotnet user-secrets set $name $value --project $project *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet user-secrets set $name failed with exit code $LASTEXITCODE."
    }
}

function New-RandomBase64([int] $byteCount) {
    $bytes = New-Object byte[] $byteCount
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }

    return [Convert]::ToBase64String($bytes)
}

$signingKeyName = 'Jwt:SigningKey'
$existing = Get-SecretNames

if ($existing -contains $signingKeyName) {
    Write-Host "$signingKeyName already exists in user-secrets. Left unchanged."
}
else {
    Set-Secret $signingKeyName (New-RandomBase64 48)
    if (-not ((Get-SecretNames) -contains $signingKeyName)) {
        throw "$signingKeyName was not found in user-secrets after setting it."
    }

    Write-Host "$signingKeyName created in user-secrets (48 random bytes, base64). The value is not shown."
}

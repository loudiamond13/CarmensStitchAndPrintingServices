<#
.SYNOPSIS
    Creates the local development secrets of src/Csps.Server in dotnet user-secrets (D-15, T-01-31).

.DESCRIPTION
    Safe to run any number of times. Each secret is created only when it is missing; an existing value is
    never changed, because replacing it would sign out every local session that used the old value.

      - Jwt:SigningKey  48 random bytes from RandomNumberGenerator, base64-encoded (HS256 needs at least 32).
      - DataProtection:CertificateBase64 and DataProtection:CertificatePassword
                        A self-signed RSA-3072 certificate ("CN=Csps Dev Data Protection", valid 10 years),
                        created entirely in memory (never in the Windows certificate store), exported as a PFX
                        under a random password. It encrypts the local Data Protection key ring (SEC-04, D-15).
                        Regenerating it would make the stored dev keys unreadable, so an existing one is kept.

    The values are written only to this user's user-secrets file for the project's UserSecretsId
    (%APPDATA%\Microsoft\UserSecrets\<id>\secrets.json). Nothing goes into git, into environment variables or
    into machine settings, and no secret value is ever printed. The certificate pair is passed to
    "dotnet user-secrets" through standard input, so it never appears on a command line.

    Production never uses user-secrets: the host settings supply these values there
    (docs/operations/data-protection-rotation.md). Compatible with Windows PowerShell 5.1.

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

# Stores several secrets at once from JSON on standard input, so no value is ever on a command line. The tool
# merges them into the existing store and prints only a count, which is discarded.
function Set-SecretsFromStdin([hashtable] $secrets) {
    $json = $secrets | ConvertTo-Json -Compress
    $json | & dotnet user-secrets set --project $project *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet user-secrets set (standard input) failed with exit code $LASTEXITCODE."
    }
}

# Creates the dev Data Protection certificate in memory only: an RSA-3072 key, a self-signed certificate valid for
# 10 years, exported as a PFX under a random password. Nothing touches the Windows certificate store or the disk.
function New-DataProtectionPfx {
    $rsa = [System.Security.Cryptography.RSA]::Create(3072)
    try {
        $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
            'CN=Csps Dev Data Protection',
            $rsa,
            [System.Security.Cryptography.HashAlgorithmName]::SHA256,
            [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
        $usage = [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment -bor
            [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DataEncipherment
        $request.CertificateExtensions.Add(
            [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new($usage, $true))

        $notBefore = [DateTimeOffset]::UtcNow.AddDays(-1)
        $certificate = $request.CreateSelfSigned($notBefore, $notBefore.AddYears(10))
        try {
            $password = New-RandomBase64 32
            $pfx = $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password)
            return @{ Base64 = [Convert]::ToBase64String($pfx); Password = $password }
        }
        finally {
            $certificate.Dispose()
        }
    }
    finally {
        $rsa.Dispose()
    }
}

$signingKeyName = 'Jwt:SigningKey'
$certificateName = 'DataProtection:CertificateBase64'
$certificatePasswordName = 'DataProtection:CertificatePassword'
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

if ($existing -contains $certificateName) {
    if (-not ($existing -contains $certificatePasswordName)) {
        throw ("$certificateName exists but $certificatePasswordName does not. Not regenerating, because that would " +
            "make the stored dev keys unreadable. Restore the password, or remove both entries with " +
            "'dotnet user-secrets remove' and run this script again.")
    }

    Write-Host "$certificateName and $certificatePasswordName already exist in user-secrets. Left unchanged."
}
else {
    $pfx = New-DataProtectionPfx
    Set-SecretsFromStdin @{ $certificateName = $pfx.Base64; $certificatePasswordName = $pfx.Password }
    $pfx = $null

    $after = Get-SecretNames
    if (-not (($after -contains $certificateName) -and ($after -contains $certificatePasswordName))) {
        throw "$certificateName or $certificatePasswordName was not found in user-secrets after setting them."
    }

    Write-Host "$certificateName and $certificatePasswordName created in user-secrets (RSA-3072, 10 years, in memory only). The values are not shown."
}

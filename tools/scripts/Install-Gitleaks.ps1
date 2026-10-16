<#
.SYNOPSIS
    Installs the pinned gitleaks 8.30.1 for the local pre-commit secret scan (OPS-03, D-10).

.DESCRIPTION
    gitleaks (MIT) finds secrets such as keys and passwords before they are committed. This script:

      1. Downloads gitleaks_8.30.1_windows_x64.zip from the official GitHub release.
      2. Refuses the file unless its SHA-256 matches the value approved by the owner (the same release the
         CI secret scan uses). A mismatch deletes the download and exits with code 1.
      3. Extracts gitleaks.exe into artifacts/tools/gitleaks/8.30.1 (git-ignored) and prints its path.

    With -SetHooksPath it also points this repository at the committed hooks folder (.githooks), so the
    pre-commit hook scans every staged change. That is the only setting it changes: it sets the
    repository-local core.hooksPath and nothing at User or Machine level.

    Safe to re-run. Compatible with Windows PowerShell 5.1 and PowerShell 7.

.PARAMETER SetHooksPath
    Also run "git config --local core.hooksPath .githooks" in this repository.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Install-Gitleaks.ps1 -SetHooksPath
#>
[CmdletBinding()]
param(
    [switch]$SetHooksPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Version, asset and checksum approved in docs/dependencies.json. Keep in step with .github/workflows/hygiene.yml.
$version = '8.30.1'
$asset = "gitleaks_${version}_windows_x64.zip"
$url = "https://github.com/gitleaks/gitleaks/releases/download/v${version}/${asset}"
$expectedSha256 = 'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$toolDir = Join-Path $repoRoot "artifacts/tools/gitleaks/$version"
$exePath = Join-Path $toolDir 'gitleaks.exe'

if (-not (Test-Path -LiteralPath $exePath)) {
    New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
    $zipPath = Join-Path $toolDir $asset

    Write-Host "Downloading $asset"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

    $actual = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expectedSha256) {
        Remove-Item -LiteralPath $zipPath -Force
        Write-Host "The download does not match the approved checksum, so it was deleted and nothing was installed."
        Write-Host "Expected $expectedSha256"
        Write-Host "Got      $actual"
        exit 1
    }

    Expand-Archive -LiteralPath $zipPath -DestinationPath $toolDir -Force
    Remove-Item -LiteralPath $zipPath -Force

    if (-not (Test-Path -LiteralPath $exePath)) {
        Write-Host "gitleaks.exe was not found in the archive."
        exit 1
    }
}

Write-Host "gitleaks $version is at $exePath"

if ($SetHooksPath) {
    & git -C $repoRoot config --local core.hooksPath .githooks
    if ($LASTEXITCODE -ne 0) {
        throw "git config failed with exit code $LASTEXITCODE."
    }

    Write-Host 'Pre-commit hook enabled for this repository (core.hooksPath = .githooks).'
}
else {
    Write-Host 'Run again with -SetHooksPath to enable the pre-commit hook for this repository.'
}

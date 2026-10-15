<#
.SYNOPSIS
    License gate over every NuGet package (direct and transitive) and generator of THIRD-PARTY-NOTICES.md
    (QUAL-06, D-00, D-18).

.DESCRIPTION
    1. Restores the local dotnet tools and the solution (nuget-license reads the restore output).
    2. License gate: runs nuget-license over every project in Csps.slnx, transitive packages included, against
       the allow-list in docs/allowed-licenses.json. A package whose license is outside the list, or whose
       license cannot be determined (a license file or URL that does not map to an allowed SPDX id), fails the
       run with exit code 1, UNLESS its id AND exact version match an owner-approved entry in
       docs/license-exceptions.json. Any other version of an excepted package still fails. An exception entry
       that matches no failing package (for example after an upgrade) also fails, so the list cannot go stale.
    3. Notices: runs nuget-license over the four shipping projects (src/Csps.Domain, src/Csps.Application,
       src/Csps.Infrastructure, src/Csps.Server), transitive packages included, and writes
       THIRD-PARTY-NOTICES.md (package, version, license, project URL), sorted and without a timestamp so the
       file only changes when the package graph changes. Excepted packages are listed under the license name
       recorded in the exceptions file, with a link to the full license text.

    Policy (D-00 free only, D-18 allow-list with review): never add a license to docs/allowed-licenses.json, or
    an entry to docs/license-exceptions.json, to make this gate pass. A package outside the list is reported to
    the owner first, and an exception is added only after the owner approves that exact package version. The
    MPL-2.0 (axe, test only) and OFL-1.1 (@fontsource fonts) exceptions are web packages and are added with
    their scope in Phase 2.

    nuget-license (Apache-2.0) is a local dotnet tool pinned in .config/dotnet-tools.json. It looks package
    metadata up on nuget.org, so the run needs network access.

    Compatible with Windows PowerShell 5.1 and PowerShell 7.

.PARAMETER AllowListPath
    The license allow-list. Defaults to docs/allowed-licenses.json. Only override it to prove the gate fails;
    CI and developers use the default.

.PARAMETER ExceptionsPath
    The version-pinned exceptions. Defaults to docs/license-exceptions.json. Only override it to prove the gate
    fails; CI and developers use the default.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/New-ThirdPartyNotices.ps1
#>
[CmdletBinding()]
param(
    [string]$AllowListPath = '',
    [string]$ExceptionsPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if ([string]::IsNullOrWhiteSpace($AllowListPath)) {
    $AllowListPath = Join-Path $repoRoot 'docs\allowed-licenses.json'
}
if ([string]::IsNullOrWhiteSpace($ExceptionsPath)) {
    $ExceptionsPath = Join-Path $repoRoot 'docs\license-exceptions.json'
}
$solution = Join-Path $repoRoot 'Csps.slnx'
$noticesPath = Join-Path $repoRoot 'THIRD-PARTY-NOTICES.md'
$workDirectory = Join-Path $repoRoot 'artifacts\licenses'

# The projects that ship with the site. Test projects and tools/ are gated but not listed in the notices.
$shippingProjects = @(
    'src\Csps.Domain\Csps.Domain.csproj',
    'src\Csps.Application\Csps.Application.csproj',
    'src\Csps.Infrastructure\Csps.Infrastructure.csproj',
    'src\Csps.Server\Csps.Server.csproj'
)

function Invoke-Dotnet([string]$description, [string[]]$arguments) {
    Write-Host ''
    Write-Host "== $description"
    & dotnet @arguments | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "$description failed with exit code $LASTEXITCODE."
    }
}

function Get-Property([object]$item, [string]$name) {
    if ($null -eq $item) {
        return $null
    }
    $property = $item.PSObject.Properties[$name]
    if ($null -eq $property) {
        return $null
    }
    return $property.Value
}

function Get-ValidationErrors([object]$item) {
    # Always an array (never $null): @($null).Count is 1, which would count a clean package as failing.
    $value = Get-Property $item 'ValidationErrors'
    if ($null -eq $value) {
        return , @()
    }
    return , @($value | Write-Output)
}

function ConvertTo-Items([string]$path) {
    # Windows PowerShell 5.1 returns a JSON array as one object; enumerate it explicitly so both shells agree.
    $raw = Get-Content -LiteralPath $path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return , @()
    }
    $parsed = ConvertFrom-Json -InputObject $raw
    return , @($parsed | Write-Output)
}

function Invoke-NugetLicense([string]$description, [string[]]$arguments, [string]$reportPath) {
    # nuget-license exits non-zero when it finds validation errors, so its exit code alone cannot tell a
    # disallowed license from a tool failure. The JSON report decides: a non-zero exit with no report, an
    # unreadable report, or no reported error is a tool failure.
    Write-Host ''
    Write-Host "== $description"
    if (Test-Path -LiteralPath $reportPath) {
        Remove-Item -LiteralPath $reportPath -Force
    }
    $allArguments = @('nuget-license') + $arguments + @('--output', 'Json', '--file-output', $reportPath)
    & dotnet @allArguments | Out-Host
    $exitCode = $LASTEXITCODE
    if (-not (Test-Path -LiteralPath $reportPath)) {
        throw "$description failed (nuget-license exit code $exitCode) and wrote no report."
    }
    $items = ConvertTo-Items $reportPath
    $withErrors = @($items | Where-Object { (Get-ValidationErrors $_).Count -gt 0 })
    if ($exitCode -ne 0 -and $withErrors.Count -eq 0) {
        throw "$description failed (nuget-license exit code $exitCode) without reporting a license problem."
    }
    return , $items
}

function Read-LicenseExceptions([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "The license exceptions file is missing: $path"
    }
    $document = ConvertFrom-Json -InputObject (Get-Content -LiteralPath $path -Raw)
    $entries = @((Get-Property $document 'exceptions') | Write-Output)
    $problems = New-Object System.Collections.Generic.List[string]
    $required = @('packageId', 'version', 'license', 'licenseUrl', 'pulledInBy', 'reason', 'approved', 'approvedBy')
    $seen = @{}
    foreach ($entry in $entries) {
        $label = [string](Get-Property $entry 'packageId')
        foreach ($field in $required) {
            $value = Get-Property $entry $field
            if (-not ($value -is [string]) -or [string]::IsNullOrWhiteSpace($value)) {
                $problems.Add("Exception '$label': '$field' is missing or empty.")
            }
        }
        $version = [string](Get-Property $entry 'version')
        # An exact NuGet version only: no ranges, wildcards or floating versions.
        if ($version -notmatch '^\d+(\.\d+){1,3}(-[0-9A-Za-z][0-9A-Za-z.-]*)?$') {
            $problems.Add("Exception '$label': version '$version' must be one exact version (no range or wildcard).")
        }
        $approved = [string](Get-Property $entry 'approved')
        $date = [datetime]::MinValue
        if (-not [datetime]::TryParseExact($approved, 'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture,
                [System.Globalization.DateTimeStyles]::None, [ref]$date)) {
            $problems.Add("Exception '$label': approved '$approved' must be a yyyy-MM-dd date.")
        }
        $url = [string](Get-Property $entry 'licenseUrl')
        if (-not $url.StartsWith('https://', [System.StringComparison]::Ordinal)) {
            $problems.Add("Exception '$label': licenseUrl must be an https:// link to the license text.")
        }
        $key = '{0}|{1}' -f $label.ToUpperInvariant(), $version
        if ($seen.ContainsKey($key)) {
            $problems.Add("Exception '$label' $version is listed twice.")
        }
        $seen[$key] = $true
    }
    if ($problems.Count -gt 0) {
        $problems | ForEach-Object { Write-Host "  $_" }
        throw "The license exceptions file is invalid: $path"
    }
    return , $entries
}

function Find-LicenseException([object[]]$exceptions, [string]$packageId, [string]$version) {
    # NuGet ids are case-insensitive; the version must match exactly.
    foreach ($exception in $exceptions) {
        if ([string]::Equals([string]$exception.packageId, $packageId, [System.StringComparison]::OrdinalIgnoreCase) -and
            [string]::Equals([string]$exception.version, $version, [System.StringComparison]::Ordinal)) {
            return $exception
        }
    }
    return $null
}

function ConvertTo-MarkdownCell([object]$value) {
    if ($null -eq $value) {
        return ''
    }
    $text = ([string]$value).Trim() -replace '\r?\n', ' '
    return $text.Replace('|', '\|')
}

if (-not (Test-Path -LiteralPath $AllowListPath)) {
    throw "The license allow-list is missing: $AllowListPath"
}
$exceptions = Read-LicenseExceptions $ExceptionsPath

if (Test-Path -LiteralPath $workDirectory) {
    Remove-Item -LiteralPath $workDirectory -Recurse -Force
}
New-Item -ItemType Directory -Path $workDirectory | Out-Null

Push-Location $repoRoot
try {
    Invoke-Dotnet 'Restore local dotnet tools' @('tool', 'restore')
    Invoke-Dotnet 'Restore the solution' @('restore', $solution, '-tl:off', '-v', 'q')

    # 1. Gate: every project in the solution, transitive packages included; only failures are reported.
    $gateItems = Invoke-NugetLicense 'License gate (every project in Csps.slnx, transitive packages included)' @(
        '--input', $solution, '--include-transitive', '--allowed-license-types', $AllowListPath, '--error-only'
    ) (Join-Path $workDirectory 'gate-errors.json')

    $excused = New-Object System.Collections.Generic.List[string]
    $failures = New-Object System.Collections.Generic.List[string]
    $usedExceptions = @{}
    foreach ($item in $gateItems) {
        $errors = Get-ValidationErrors $item
        if ($errors.Count -eq 0) {
            continue
        }
        $packageId = [string](Get-Property $item 'PackageId')
        $version = [string](Get-Property $item 'PackageVersion')
        $exception = Find-LicenseException $exceptions $packageId $version
        if ($null -ne $exception) {
            $usedExceptions[('{0}|{1}' -f $packageId.ToUpperInvariant(), $version)] = $true
            $excused.Add("$packageId $version ($($exception.license); owner-approved $($exception.approved))")
            continue
        }
        $license = Get-Property $item 'License'
        $reasons = @($errors | ForEach-Object { [string](Get-Property $_ 'Error') } | Sort-Object -Unique) -join '; '
        $failures.Add("$packageId $version (license '$license'): $reasons")
    }

    $stale = @($exceptions | Where-Object {
            -not $usedExceptions.ContainsKey(('{0}|{1}' -f ([string]$_.packageId).ToUpperInvariant(), [string]$_.version))
        } | ForEach-Object { "$($_.packageId) $($_.version)" })

    foreach ($line in $excused) {
        Write-Host "  Allowed by owner-approved exception: $line"
    }
    if ($failures.Count -gt 0 -or $stale.Count -gt 0) {
        Write-Host ''
        foreach ($line in $failures) {
            Write-Host "  NOT ALLOWED: $line"
        }
        foreach ($line in $stale) {
            Write-Host "  STALE EXCEPTION (matches no package in the build; remove it or get a new approval): $line"
        }
        Write-Host ''
        Write-Host 'License gate FAILED. The packages above have a license outside docs/allowed-licenses.json, or one that'
        Write-Host 'could not be determined, and no owner-approved exception for that exact version. Report them to the'
        Write-Host 'owner; do not widen the allow-list or the exceptions to make this pass (D-00, D-18).'
        exit 1
    }
    Write-Host 'License gate passed: every package uses an allowed license or an owner-approved exception.'

    # 2. Notices: the four shipping projects, transitive packages included.
    $projectListPath = Join-Path $workDirectory 'shipping-projects.json'
    $projectPaths = @($shippingProjects | ForEach-Object { Join-Path $repoRoot $_ })
    ConvertTo-Json -InputObject $projectPaths | Set-Content -LiteralPath $projectListPath -Encoding UTF8

    $packages = Invoke-NugetLicense 'License report for the shipping projects' @(
        '--json-input', $projectListPath, '--include-transitive', '--allowed-license-types', $AllowListPath
    ) (Join-Path $workDirectory 'shipping-licenses.json')
}
finally {
    Pop-Location
}

if ($packages.Count -eq 0) {
    throw 'nuget-license reported no packages for the shipping projects; refusing to write empty notices.'
}

$shippedExceptions = New-Object System.Collections.Generic.List[object]
$rows = $packages |
    Sort-Object -Property @{ Expression = { ([string]$_.PackageId).ToUpperInvariant() } }, @{ Expression = { [string]$_.PackageVersion } } |
    ForEach-Object {
        $packageId = [string](Get-Property $_ 'PackageId')
        $version = [string](Get-Property $_ 'PackageVersion')
        $license = ConvertTo-MarkdownCell (Get-Property $_ 'License')
        if ((Get-ValidationErrors $_).Count -gt 0) {
            # The gate above covers every shipping project, so this only trips if the two runs disagree.
            $exception = Find-LicenseException $exceptions $packageId $version
            if ($null -eq $exception) {
                throw "Shipping package $packageId $version failed license validation and has no exception."
            }
            $shippedExceptions.Add($exception)
            $license = '[{0}]({1})' -f (ConvertTo-MarkdownCell $exception.license), $exception.licenseUrl
        }
        elseif ([string]::IsNullOrWhiteSpace($license)) {
            $license = ConvertTo-MarkdownCell (Get-Property $_ 'LicenseUrl')
        }
        '| {0} | {1} | {2} | {3} |' -f (ConvertTo-MarkdownCell $packageId), (ConvertTo-MarkdownCell $version),
            $license, (ConvertTo-MarkdownCell (Get-Property $_ 'PackageProjectUrl'))
    }

$lines = @(
    '# Third-party notices',
    '',
    'Carmen''s Stitch & Printing Services (CSPS) ships the packages below. Each one is used under its own license,',
    'shown here as an SPDX identifier or, for the free Microsoft components listed further down, as the license',
    'name with a link to its full text. The list covers the four shipping projects (src/Csps.Domain,',
    'src/Csps.Application, src/Csps.Infrastructure and src/Csps.Server), including the packages they pull in.',
    'Test projects and developer tools do not ship and are not listed.',
    '',
    'This file is generated by `tools/scripts/New-ThirdPartyNotices.ps1`. Do not edit it by hand.',
    '',
    "Packages: $($packages.Count)",
    '',
    '| Package | Version | License | Project URL |',
    '| --- | --- | --- | --- |'
) + @($rows)

if ($shippedExceptions.Count -gt 0) {
    $lines += @(
        '',
        '## Free Microsoft components that are not open source',
        '',
        'The packages below are free Microsoft components that the SQL Server driver needs. They are not open',
        'source: they come under the Microsoft Software License Terms, not an open-source license. They cost',
        'nothing, ship unmodified inside the app only, and Microsoft''s notices are kept. The owner approved each',
        'exact version (docs/license-exceptions.json).',
        '',
        '| Package | Version | License | Brought in by | Approved |',
        '| --- | --- | --- | --- | --- |'
    )
    $lines += @($shippedExceptions |
            Sort-Object -Property @{ Expression = { ([string]$_.packageId).ToUpperInvariant() } } |
            ForEach-Object {
                '| {0} | {1} | [{2}]({3}) | {4} | {5} by the {6} |' -f (ConvertTo-MarkdownCell $_.packageId),
                (ConvertTo-MarkdownCell $_.version), (ConvertTo-MarkdownCell $_.license), $_.licenseUrl,
                (ConvertTo-MarkdownCell $_.pulledInBy), (ConvertTo-MarkdownCell $_.approved), (ConvertTo-MarkdownCell $_.approvedBy)
            })
}

# Bundled data files (kind "data" in docs/dependencies.json): listed with license, copyright and pinned source.
$registryPath = Join-Path $repoRoot 'docs\dependencies.json'
if (-not (Test-Path -LiteralPath $registryPath)) {
    throw "The dependency registry is missing: $registryPath"
}
$registry = ConvertFrom-Json -InputObject (Get-Content -LiteralPath $registryPath -Raw)
$dataRecords = @((Get-Property $registry 'packages') | Write-Output | Where-Object { (Get-Property $_ 'kind') -eq 'data' } |
        Sort-Object -Property @{ Expression = { ([string]$_.id).ToUpperInvariant() } })
if ($dataRecords.Count -gt 0) {
    $lines += @(
        '',
        '## Bundled data files',
        '',
        'The files below are data, not code, and ship inside the app unchanged. Each is pinned to an exact source',
        'commit and a SHA-256 hash in docs/dependencies.json, and a test fails if the bytes ever differ.',
        '',
        '| File | License | Copyright | Source |',
        '| --- | --- | --- | --- |'
    )
    $lines += @($dataRecords | ForEach-Object {
            '| {0} | {1} | {2} | {3} |' -f (ConvertTo-MarkdownCell $_.id), (ConvertTo-MarkdownCell $_.license),
            (ConvertTo-MarkdownCell (Get-Property $_ 'copyright')), (ConvertTo-MarkdownCell $_.source)
        })
    if (@($dataRecords | Where-Object { $_.license -eq 'MIT' }).Count -gt 0) {
        $lines += @(
            '',
            'Files above marked MIT are used under this license:',
            '',
            'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated',
            'documentation files (the "Software"), to deal in the Software without restriction, including without limitation',
            'the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and',
            'to permit persons to whom the Software is furnished to do so, subject to the following conditions:',
            '',
            'The above copyright notice and this permission notice shall be included in all copies or substantial portions of',
            'the Software.',
            '',
            'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO',
            'THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
            'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF',
            'CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER',
            'DEALINGS IN THE SOFTWARE.'
        )
    }
}

# UTF-8 without a byte-order mark, LF line endings, one trailing newline (same output on Windows PowerShell 5.1).
$content = ($lines -join "`n") + "`n"
[System.IO.File]::WriteAllText($noticesPath, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ''
Write-Host "Wrote $noticesPath ($($packages.Count) packages, $($shippedExceptions.Count) under an owner-approved exception, $($dataRecords.Count) bundled data file(s))."
exit 0

<#
.SYNOPSIS
    Measures .NET unit-test coverage per assembly and fails when a threshold is not met (QUAL-03, D-17, D-31).

.DESCRIPTION
    One command for the local machine and for CI. CI (ubuntu, PowerShell 7) and Windows PowerShell 5.1 run it the same way:

      1. Deletes artifacts/coverage.
      2. Runs tests/Csps.Domain.UnitTests with coverlet.MTP, instrumenting only Csps.Domain, and
         tests/Csps.Application.UnitTests, instrumenting only Csps.Application. Coverage is measured from the
         unit tests alone: integration tests never count toward these numbers.
      3. Runs ReportGenerator once per assembly over the timestamped Cobertura file(s), with an assembly filter
         and minimumCoverageThresholds. ReportGenerator exits non-zero below a threshold.
      4. Re-reads ReportGenerator's JsonSummary and fails closed when the expected assembly is missing or has no
         coverable lines. (A filter that matches nothing makes ReportGenerator report 0 assemblies and pass.)

    Thresholds (defaults from D-17 and D-31):
      - Csps.Domain:      100% line and 100% branch.
      - Csps.Application: at least 95% line. Branch is not gated (D-31, a planner default the owner may tighten;
                          that is a one-line change here).

    Exclusions: none are added by this script. coverlet's defaults skip only compiler-generated and
    [GeneratedCode] members. Never reach a threshold with [ExcludeFromCodeCoverage] or --coverlet-exclude on
    production code; add unit tests instead.

    The web thresholds in QUAL-03 (web/src/core/api 100%, web 90%) apply once web/ exists (Phase 2); they are
    enforced by Vitest, not by this script.

    Licenses: coverlet.MTP is MIT and ReportGenerator is Apache-2.0 (both free). The coverage packages
    coverlet.collector and Microsoft.Testing.Extensions.CodeCoverage are forbidden (BuildConfigTests).

    Compatible with Windows PowerShell 5.1 and PowerShell 7.

.PARAMETER DomainLineThreshold
    Minimum line coverage for Csps.Domain, in percent. Default 100.

.PARAMETER DomainBranchThreshold
    Minimum branch coverage for Csps.Domain, in percent. Default 100.

.PARAMETER ApplicationLineThreshold
    Minimum line coverage for Csps.Application, in percent. Default 95.
    Values up to 101 are accepted so the failing direction can be proven (101 can never be met).

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1 -ApplicationLineThreshold 101
    (Must exit non-zero: proves the gate can fail.)
#>
[CmdletBinding()]
param(
    [ValidateRange(0, 101)]
    [double]$DomainLineThreshold = 100,

    [ValidateRange(0, 101)]
    [double]$DomainBranchThreshold = 100,

    [ValidateRange(0, 101)]
    [double]$ApplicationLineThreshold = 95
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$invariant = [System.Globalization.CultureInfo]::InvariantCulture
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$coverageRoot = Join-Path $repoRoot 'artifacts/coverage'

function Format-Percent([double]$value) {
    return $value.ToString('0.##', $invariant)
}

function Invoke-Native([string]$description, [string[]]$arguments) {
    Write-Host ''
    Write-Host "== $description"
    # Out-Host keeps the tool output on screen and out of the calling function's return value.
    & dotnet @arguments | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "$description failed with exit code $LASTEXITCODE."
    }
}

function Measure-Assembly {
    param(
        [string]$Assembly,
        [string]$TestProject,
        [string]$Slug,
        [double]$LineThreshold,
        [Nullable[double]]$BranchThreshold
    )

    $resultsDirectory = Join-Path $coverageRoot $Slug
    $reportDirectory = Join-Path $resultsDirectory 'report'

    Invoke-Native "Unit tests with coverage: $TestProject" @(
        'test', '--project', (Join-Path $repoRoot $TestProject),
        '--coverlet', '--coverlet-output-format', 'cobertura',
        '--coverlet-include', "[$Assembly]*",
        '--results-directory', $resultsDirectory)

    # coverlet.MTP names its output coverage.cobertura.<timestamp>.xml, hence the glob.
    $reports = @(Get-ChildItem -Path $resultsDirectory -Filter 'coverage.cobertura.*.xml' -File)
    if ($reports.Count -eq 0) {
        throw "No Cobertura file was written for $Assembly under $resultsDirectory."
    }

    $reportGeneratorArguments = @(
        'reportgenerator',
        "-reports:$(Join-Path $resultsDirectory 'coverage.cobertura.*.xml')",
        "-targetdir:$reportDirectory",
        '-reporttypes:TextSummary;Html;JsonSummary',
        "-assemblyfilters:+$Assembly",
        '-verbosity:Warning',
        "minimumCoverageThresholds:lineCoverage=$($LineThreshold.ToString($invariant))")
    if ($null -ne $BranchThreshold) {
        $reportGeneratorArguments += "minimumCoverageThresholds:branchCoverage=$(([double]$BranchThreshold).ToString($invariant))"
    }

    Write-Host ''
    Write-Host "== ReportGenerator thresholds: $Assembly"
    & dotnet @reportGeneratorArguments | Out-Host
    $reportGeneratorExit = $LASTEXITCODE

    # Fail closed on an empty or mismatched report, which ReportGenerator itself would pass.
    $summaryPath = Join-Path $reportDirectory 'Summary.json'
    if (-not (Test-Path -LiteralPath $summaryPath)) {
        throw "ReportGenerator wrote no Summary.json for $Assembly (exit code $reportGeneratorExit)."
    }

    $summary = Get-Content -LiteralPath $summaryPath -Raw | ConvertFrom-Json
    $entry = @($summary.coverage.assemblies | Where-Object { $_.name -eq $Assembly })
    if ($entry.Count -ne 1 -or [int]$entry[0].coverablelines -le 0) {
        throw "The coverage report has no coverable lines for $Assembly; the gate cannot pass on an empty report."
    }

    $line = [double]$entry[0].coverage
    $totalBranches = [int]$entry[0].totalbranches
    if ($totalBranches -eq 0) {
        $branch = 100.0
    }
    else {
        $branch = [double]$entry[0].branchcoverage
    }

    $failures = @()
    if ($line -lt $LineThreshold) {
        $failures += "line $(Format-Percent $line)% < $(Format-Percent $LineThreshold)%"
    }
    if ($null -ne $BranchThreshold -and $branch -lt [double]$BranchThreshold) {
        $failures += "branch $(Format-Percent $branch)% < $(Format-Percent ([double]$BranchThreshold))%"
    }
    if ($reportGeneratorExit -ne 0 -and $failures.Count -eq 0) {
        $failures += "ReportGenerator exited with code $reportGeneratorExit"
    }

    if ($null -eq $BranchThreshold) {
        $branchRule = 'not gated'
    }
    else {
        $branchRule = ">= $(Format-Percent ([double]$BranchThreshold))%"
    }

    return [pscustomobject]@{
        Assembly        = $Assembly
        Line            = "$(Format-Percent $line)% ($($entry[0].coveredlines)/$($entry[0].coverablelines))"
        LineRule        = ">= $(Format-Percent $LineThreshold)%"
        Branch          = "$(Format-Percent $branch)% ($($entry[0].coveredbranches)/$totalBranches)"
        BranchRule      = $branchRule
        Passed          = ($failures.Count -eq 0)
        Failures        = ($failures -join '; ')
    }
}

if (Test-Path -LiteralPath $coverageRoot) {
    Remove-Item -LiteralPath $coverageRoot -Recurse -Force
}

Push-Location $repoRoot
try {
    Invoke-Native 'Restore local dotnet tools' @('tool', 'restore')

    $results = @(
        (Measure-Assembly -Assembly 'Csps.Domain' -TestProject 'tests/Csps.Domain.UnitTests' -Slug 'domain' `
            -LineThreshold $DomainLineThreshold -BranchThreshold $DomainBranchThreshold),
        (Measure-Assembly -Assembly 'Csps.Application' -TestProject 'tests/Csps.Application.UnitTests' -Slug 'application' `
            -LineThreshold $ApplicationLineThreshold -BranchThreshold $null)
    )
}
finally {
    Pop-Location
}

Write-Host ''
Write-Host '== Coverage gate'
foreach ($result in $results) {
    if ($result.Passed) {
        $status = 'PASS'
    }
    else {
        $status = 'FAIL'
    }
    Write-Host ("  {0,-17} line {1,-16} (rule {2,-7})  branch {3,-16} (rule {4})  {5}" -f `
            $result.Assembly, $result.Line, $result.LineRule, $result.Branch, $result.BranchRule, $status)
    if (-not $result.Passed) {
        Write-Host "    $($result.Failures)"
    }
}
Write-Host "  HTML reports: $coverageRoot/<assembly>/report/index.html"

$failed = @($results | Where-Object { -not $_.Passed })
if ($failed.Count -gt 0) {
    Write-Host ''
    Write-Host "Coverage gate FAILED for: $(($failed | ForEach-Object { $_.Assembly }) -join ', ')."
    exit 1
}

Write-Host ''
Write-Host 'Coverage gate passed.'
exit 0

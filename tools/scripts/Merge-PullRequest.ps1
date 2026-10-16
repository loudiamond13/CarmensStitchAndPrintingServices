<#
.SYNOPSIS
    The one supported way to merge a pull request: runs the merge gate, then squash-merges the exact commit it approved (OPS-01, D-08).

.DESCRIPTION
    GitHub's ruleset on main enforces the checks, but it cannot read the Definition of Done list, so the rules are
    also enforced here, by refusing to run the merge:

      1. Runs `node web/scripts/merge-gate.mjs <Pr>`. The gate reads the pull request with the GitHub CLI and allows the
         merge only when it is open, targets main, is not a draft, is 0 commits behind main, has no conflicts, has a passing
         `gate (full)` or `gate (docs)` check on its newest commit, has no failed, running or cancelled check, and every
         item under "Definition of Done" in the pull request body is ticked. Otherwise it prints each reason in plain
         English and this script stops without merging anything.
         The gate also refuses a pull request title that holds a GitHub skip marker, a double quote or a control character.
      2. Reads from the gate output `head=<sha>` (the exact commit the gate approved) and the squash commit message: the
         subject `<PR title> (#<n>)` and a short body naming the pull request and the approved commit, never the commit log.
      3. Runs `gh pr merge <Pr> --squash --match-head-commit <sha> --subject <subject> --body <body>`, so GitHub refuses
         the merge if anyone pushed a new commit between the check and the merge, and the squash commit gets that message.
         The branch is deleted afterwards unless -KeepBranch is given.

    Merge only when the owner says to, and never with `gh pr merge` directly or the merge button: both skip the gate.

    -LocalGate (D-16) is for months when the free CI minutes run out. The gate then replaces the green-check rule with a
    "Local full gate" section in the pull request body that lists the five local commands, each marked `exit 0`. It still
    refuses any failed check, and it prints a loud warning because CI did not check the pull request.

    Needs the GitHub CLI (`gh`, signed in) and Node on the PATH. Sets no environment variable. Compatible with Windows
    PowerShell 5.1 and PowerShell 7.

.PARAMETER Pr
    The pull request number.

.PARAMETER KeepBranch
    Keep the pull request branch after the merge. By default the branch is deleted.

.PARAMETER LocalGate
    Merge on the local full gate instead of a green CI check (D-16).

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Merge-PullRequest.ps1 -Pr 12

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Merge-PullRequest.ps1 -Pr 12 -LocalGate -KeepBranch
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 2147483647)]
    [int]$Pr,

    [switch]$KeepBranch,

    [switch]$LocalGate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '..')).Path
$gateScript = Join-Path (Join-Path (Join-Path $repoRoot 'web') 'scripts') 'merge-gate.mjs'

$gateArguments = @($gateScript, "$Pr")
if ($LocalGate) {
    $gateArguments += '--local-gate'
}

# The gate prints its refusal reasons and warnings on stderr, which goes straight to the console.
Push-Location $repoRoot
try {
    $gateOutput = @(& node @gateArguments)
    $gateExit = $LASTEXITCODE
}
finally {
    Pop-Location
}

foreach ($line in $gateOutput) {
    if ("$line" -notmatch '^(subject|body)-base64=') {
        Write-Host $line
    }
}
if ($gateExit -ne 0) {
    throw "The merge gate refused pull request #$Pr (exit code $gateExit). Nothing was merged."
}

function Get-GateValue {
    param([string]$Name, [string]$Pattern)
    $found = @($gateOutput | Where-Object { "$_" -match "^$Name=($Pattern)$" })
    if ($found.Count -ne 1) {
        throw "The merge gate did not print exactly one $Name= line, so the merge cannot go ahead. Nothing was merged."
    }
    return ("$($found[0])").Substring($Name.Length + 1)
}

$headSha = Get-GateValue -Name 'head' -Pattern '[0-9a-f]{40}'
# The gate sends the message as base64 of UTF-8, because Windows PowerShell 5.1 decodes node output with the console code page.
$subject = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String((Get-GateValue -Name 'subject-base64' -Pattern '[A-Za-z0-9+/]+={0,2}')))
$body = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String((Get-GateValue -Name 'body-base64' -Pattern '[A-Za-z0-9+/]+={0,2}')))

$mergeArguments = @('pr', 'merge', "$Pr", '--squash', '--match-head-commit', $headSha, '--subject', $subject, '--body', $body)
if (-not $KeepBranch) {
    $mergeArguments += '--delete-branch'
}

Push-Location $repoRoot
try {
    & gh @mergeArguments
    $mergeExit = $LASTEXITCODE
}
finally {
    Pop-Location
}
if ($mergeExit -ne 0) {
    throw "gh could not merge pull request #$Pr (exit code $mergeExit). If a new commit was pushed after the gate ran, run this command again."
}

Write-Host "Merged pull request #$Pr at commit $headSha with the subject: $subject"

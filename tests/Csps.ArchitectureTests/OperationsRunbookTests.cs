using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// Doc-lint for the Manager runbooks (LEGAL-06, 14 D-16 to D-21, D-28; threat T-14-13). The runbooks are public, so each one
/// keeps its timestamp line, names "the owner" and holds no email address, Philippine phone number or local user path.
/// Each runbook also keeps the phrases its ruling needs.
/// </summary>
public sealed partial class OperationsRunbookTests
{
    private static readonly (string Path, string[] Phrases)[] Runbooks =
    [
        (
            "docs/operations/data-requests.md",
            [
                "15 days",
                "Delete Request",
                "became an order",
                "No ID photo",
                "shop mailbox",
                "audit-log.md",
            ]
        ),
        (
            "docs/operations/breach-response.md",
            [
                "72 hours",
                "NPC Circular 16-03",
                "RA 10173",
                "confirm with the NPC or an adviser",
                "Deactivate",
                "Set Temporary Password",
                "holding page",
                "data-protection-rotation.md",
            ]
        ),
        (
            "docs/operations/break-glass-mail.md",
            [
                "mail-setup.md",
                "never a way around the emailed code",
                "SMTP",
            ]
        ),
        (
            "docs/operations/lockout.md",
            [
                "15 minutes",
                "Forgot password?",
                "Unlock",
                "reviewed one-off",
                "the ORM",
                "not built in advance",
                "never inline SQL",
            ]
        ),
        (
            "docs/operations/install-staff-app.md",
            [
                "Install app",
                "Add to Home Screen",
                "sign in again",
                "no install button",
            ]
        ),
    ];

    // Each detector paired with samples it must catch, so a broken pattern cannot pass silently.
    private static readonly (Regex Pattern, string Sample)[] PersonalDetailDetectors =
    [
        (EmailAddress(), "someone@example.com"),
        (PhilippinePhone(), "0917 123 4567"),
        (PhilippinePhone(), "+63 917 123 4567"),
        (PhilippinePhone(), "(02) 8123 4567"),
        (UserProfilePath(), "C:/Users/someone/"),
        (UserProfilePath(), @"C:\Users\someone\Desktop"),
    ];

    [Fact]
    public void EveryRunbookExistsWithItsTimestampLine()
    {
        var problems = new List<string>();
        foreach (var (path, _) in Runbooks)
        {
            if (!File.Exists(RepoRoot.PathOf(path)))
            {
                problems.Add($"{path} is missing.");
                continue;
            }

            if (!TimestampLine().IsMatch(Read(path)))
            {
                problems.Add($"{path} has no '*Created: <ISO time> · Updated: <ISO time>*' line.");
            }
        }

        problems.ShouldBeEmpty();
    }

    [Fact]
    public void EveryRunbookNamesTheOwner()
    {
        var problems = Runbooks
            .Where(runbook => File.Exists(RepoRoot.PathOf(runbook.Path)))
            .Where(runbook => !Read(runbook.Path).Contains("the owner", StringComparison.Ordinal))
            .Select(runbook => $"{runbook.Path} never says 'the owner'.")
            .ToList();

        problems.ShouldBeEmpty();
    }

    [Fact]
    public void EveryRunbookKeepsItsRulingPhrases()
    {
        var problems = new List<string>();
        foreach (var (path, phrases) in Runbooks)
        {
            if (!File.Exists(RepoRoot.PathOf(path)))
            {
                problems.Add($"{path} is missing.");
                continue;
            }

            var text = Read(path);
            problems.AddRange(
                phrases
                    .Where(phrase => !text.Contains(phrase, StringComparison.Ordinal))
                    .Select(phrase => $"{path} does not say '{phrase}'."));
        }

        problems.ShouldBeEmpty();
    }

    [Fact]
    public void NoRunbookHoldsPersonalDetails()
    {
        foreach (var (pattern, sample) in PersonalDetailDetectors)
        {
            pattern.IsMatch(sample).ShouldBeTrue($"Detector {pattern} must catch: {sample}");
        }

        var found = new List<string>();
        foreach (var (path, _) in Runbooks.Where(runbook => File.Exists(RepoRoot.PathOf(runbook.Path))))
        {
            var text = Read(path);
            found.AddRange(
                PersonalDetailDetectors
                    .Select(detector => detector.Pattern)
                    .Distinct()
                    .SelectMany(pattern => pattern.Matches(text).Select(match => $"{path}: {match.Value}")));
        }

        found.ShouldBeEmpty("A runbook must say 'the owner' and 'the shop mailbox', never a name, email, phone or local path.");
    }

    // The code limit is ten wrong codes in an hour (AuthSettings.AccountFailureCap) and a pause of 15 minutes
    // (AuthSettings.CodeLockoutDuration). Every doc that mentions it must say the same.
    [Theory]
    [InlineData("docs/operations/lockout.md")]
    [InlineData("docs/operations/a11y-manual-passes.md")]
    [InlineData("docs/operations/audit-log.md")]
    [InlineData("docs/operations/security-review.md")]
    public void TheWrongCodeLimitIsStatedTheSameWayInEveryDoc(string path) =>
        CodeLimit().IsMatch(Read(path)).ShouldBeTrue($"{path} must say 'ten wrong codes in an hour' and the pause of 15 minutes.");

    [Fact]
    public void TheLockoutRunbookSaysAUsedUpCodeIsNotAPause() =>
        Read("docs/operations/lockout.md").ShouldContain("This code can't be used anymore", Case.Sensitive);

    private static string Read(string path) => File.ReadAllText(RepoRoot.PathOf(path));

    [GeneratedRegex(@"ten wrong codes in an hour[^.\n]{0,100}15 minutes", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex CodeLimit();

    [GeneratedRegex(
        @"^\*Created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2} · Updated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}\*\s*$",
        RegexOptions.CultureInvariant | RegexOptions.Multiline)]
    private static partial Regex TimestampLine();

    [GeneratedRegex(@"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)+", RegexOptions.CultureInvariant)]
    private static partial Regex EmailAddress();

    // Mobile numbers (+63 9xx, 09xx) and landlines written as (02) 8123 4567.
    [GeneratedRegex(
        @"(?<!\d)(?:\+?63|0)[\s\-]?9\d{2}[\s\-]?\d{3}[\s\-]?\d{4}(?!\d)|\(0\d{1,2}\)\s?\d{3,4}[\s\-]?\d{4}",
        RegexOptions.CultureInvariant)]
    private static partial Regex PhilippinePhone();

    [GeneratedRegex(@"[A-Za-z]:[\\/]Users[\\/]", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex UserProfilePath();
}

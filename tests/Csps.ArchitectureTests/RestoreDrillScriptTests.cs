using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// Text rules for the backup restore drill (plan 14-08, 14 D-07 and D-40, threats T-14-15 to T-14-17). The drill script may
/// only restore into CSPS_RestoreDrill on the default LocalDB instance, may only take a .bak from the project's _local
/// folder, must check the backup before it drops or restores anything, and may only read catalog metadata plus the latest
/// migration id.
/// </summary>
public sealed partial class RestoreDrillScriptTests
{
    private const string ScriptPath = "tools/scripts/Restore-BackupDrill.ps1";
    private const string DrillDatabase = "CSPS_RestoreDrill";

    [Fact]
    public void ScriptHasFixedTargets()
    {
        var script = ReadScript();

        script.ShouldContain(@"(localdb)\MSSQLLocalDB");
        script.ShouldContain(DrillDatabase);

        var parameters = ParamBlock(script);
        ForbiddenParameter().Matches(parameters).Select(match => match.Value).ShouldBeEmpty(
            "The server and database are fixed in the script; they must never be parameters.");

        var drops = DropStatement().Matches(CodeOnly(script)).Select(match => match.Groups["name"].Value).ToList();
        drops.ShouldNotBeEmpty("The script must drop the drill database for -Replace and -Drop.");
        drops.ShouldAllBe(name => string.Equals(name, "[CSPS_RestoreDrill]", StringComparison.Ordinal));
    }

    [Fact]
    public void ScriptTakesTheDocumentedParameters()
    {
        var names = ParameterName().Matches(ParamBlock(ReadScript())).Select(match => match.Groups["name"].Value).ToList();

        names.ShouldBe(
            ["BakPath", "Replace", "Drop", "ReceiptPath", "ExpectedOrders", "ExpectedUsers", "ExpectedQuoteRequests", "ExpectedMigration"],
            ignoreOrder: true);
    }

    [Fact]
    public void ScriptNeverNamesAnotherDatabaseAsATarget()
    {
        var code = CodeOnly(ReadScript());

        foreach (var name in new[] { "CSPS_Dev", "CSPS_E2E", "CSPS_Legacy_Restore", "BetsLLC_" })
        {
            code.Contains(name, StringComparison.OrdinalIgnoreCase).ShouldBeFalse($"The script code must never name {name}.");
        }
    }

    [Fact]
    public void ScriptReadsMetadataAndTheMigrationIdOnly()
    {
        var code = CodeOnly(ReadScript());

        code.ShouldContain("sys.tables");
        code.ShouldContain("sys.schemas");
        code.ShouldContain("sys.partitions");
        code.ShouldNotContain("SELECT *");

        var sources = SqlSource().Matches(code)
            .Select(match => match.Groups["name"].Value)
            .Where(name => !string.Equals(name, "DISK", StringComparison.Ordinal))
            .ToList();
        sources.ShouldNotBeEmpty();

        var userTables = sources.Where(name => !name.Contains("sys.", StringComparison.Ordinal)).ToList();
        userTables.ShouldNotBeEmpty("The script must read the latest migration id.");
        userTables.ShouldAllBe(
            name => string.Equals(name, "[CSPS_RestoreDrill].[dbo].[__EFMigrationsHistory]", StringComparison.Ordinal),
            "Every query may read only catalog views and the migration history, never another user table.");
        code.ShouldContain("SELECT TOP (1) [MigrationId]");
    }

    [Fact]
    public void ScriptKeepsTheBakLocal()
    {
        var code = CodeOnly(ReadScript());

        var localCheck = code.IndexOf("'_local'", StringComparison.Ordinal);
        var extensionCheck = code.IndexOf(".EndsWith('.bak'", StringComparison.OrdinalIgnoreCase);
        var firstOpen = code.IndexOf(".Open()", StringComparison.Ordinal);

        localCheck.ShouldBeGreaterThanOrEqualTo(0, "The script must check the path against the _local folder.");
        extensionCheck.ShouldBeGreaterThanOrEqualTo(0, "The script must check that the file ends in .bak.");
        firstOpen.ShouldBeGreaterThan(0, "The script must open a connection to restore.");
        localCheck.ShouldBeLessThan(firstOpen, "The _local check must run before any connection is opened.");
        extensionCheck.ShouldBeLessThan(firstOpen, "The .bak check must run before any connection is opened.");
        code.ShouldContain("ReparsePoint", Case.Sensitive, "A link inside _local could point anywhere, so links are refused.");
    }

    [Fact]
    public void ScriptRefusesALinkOnEveryFolderBetweenTheBakAndLocal()
    {
        var code = CodeOnly(ReadScript());

        var loop = code.IndexOf("while ($dir.Length -ge $localRoot.Length)", StringComparison.Ordinal);
        loop.ShouldBeGreaterThanOrEqualTo(0, "The script must walk every folder from the .bak up to _local.");

        var linkCheck = code.IndexOf("ReparsePoint", loop, StringComparison.Ordinal);
        linkCheck.ShouldBeGreaterThan(loop, "Each folder on the way must be checked for a link.");
        code.IndexOf("Split-Path -Parent $dir", loop, StringComparison.Ordinal).ShouldBeGreaterThan(loop);
        code.ShouldContain("no folder on the way", Case.Sensitive, "The refusal must name the folder rule.");
    }

    [Theory]
    [InlineData("$info = $connection.CreateCommand()", "$info.ExecuteReader()", "$counts = $connection.CreateCommand()")]
    [InlineData("$counts = $connection.CreateCommand()", "$counts.ExecuteReader()", "$migration = $connection.CreateCommand()")]
    [InlineData("$migration = $connection.CreateCommand()", "$migration.ExecuteScalar()", "$connection.Dispose()")]
    public void ScriptCatchesAReadThatFailsAfterTheRestoreSoTheReceiptIsStillWritten(string start, string read, string next)
    {
        var code = CodeOnly(ReadScript());

        var startAt = code.IndexOf(start, StringComparison.Ordinal);
        var readAt = code.IndexOf(read, StringComparison.Ordinal);
        var nextAt = code.IndexOf(next, StringComparison.Ordinal);
        startAt.ShouldBeGreaterThanOrEqualTo(0);
        readAt.ShouldBeGreaterThan(startAt);
        nextAt.ShouldBeGreaterThan(readAt);

        var tryAt = code.IndexOf("try {", startAt, StringComparison.Ordinal);
        (tryAt >= 0 && tryAt < readAt).ShouldBeTrue($"{read} must run inside a try block.");
        var catchAt = code.IndexOf("catch {", readAt, StringComparison.Ordinal);
        (catchAt >= 0 && catchAt < nextAt).ShouldBeTrue($"{read} must have a catch that records the failure.");
        code.IndexOf("$readProblems.Add(", catchAt, StringComparison.Ordinal).ShouldBeLessThan(nextAt);
    }

    [Fact]
    public void ScriptShowsAFailedReadInTheReceiptAndTheExitCode()
    {
        var code = CodeOnly(ReadScript());

        code.ShouldContain("$readProblems.Count -gt 0");
        code.ShouldContain("'| Reads after the restore |");
    }

    [Fact]
    public void ScriptKeepsTheCheckDbErrorTextOnTheConsoleOnly()
    {
        var code = CodeOnly(ReadScript());

        var check = code.IndexOf("$check.ExecuteNonQuery()", StringComparison.Ordinal);
        var next = code.IndexOf("$info = $connection.CreateCommand()", StringComparison.Ordinal);
        var catchBlock = code.Substring(check, next - check);

        catchBlock.ShouldContain("[Console]::Error.WriteLine", Case.Sensitive, "The CHECKDB error text must reach the console.");
        catchBlock.ShouldContain("$_.Exception.Message", Case.Sensitive);
        code.ShouldNotContain("'| DBCC CHECKDB | ' + $_", Case.Sensitive);
    }

    [Fact]
    public void ScriptValidatesTheBackupBeforeDroppingOrRestoring()
    {
        var code = CodeOnly(ReadScript());

        var fileList = code.IndexOf("RESTORE FILELISTONLY", StringComparison.Ordinal);
        var verify = code.IndexOf("RESTORE VERIFYONLY", StringComparison.Ordinal);
        var drop = code.IndexOf("DROP DATABASE", StringComparison.Ordinal);
        var restore = code.IndexOf("RESTORE DATABASE", StringComparison.Ordinal);

        fileList.ShouldBeGreaterThanOrEqualTo(0, "The script must read the backup's file list.");
        verify.ShouldBeGreaterThanOrEqualTo(0, "The script must verify the backup (RESTORE VERIFYONLY).");
        drop.ShouldBeGreaterThan(0, "The script must drop the drill database for -Replace and -Drop.");
        restore.ShouldBeGreaterThan(0, "The script must restore the backup.");
        fileList.ShouldBeLessThan(drop, "The backup's file list must be read before the drill database is dropped.");
        verify.ShouldBeLessThan(drop, "The backup must be verified before the drill database is dropped.");
        verify.ShouldBeLessThan(restore, "The backup must be verified before it is restored.");
        drop.ShouldBeLessThan(restore, "An existing drill database is dropped before the restore, never after.");
    }

    [Fact]
    public void ScriptChecksTheRestoredDatabaseWithCheckDb()
    {
        var code = CodeOnly(ReadScript());

        var restore = code.IndexOf("RESTORE DATABASE", StringComparison.Ordinal);
        // The script writes the SQL quotes doubled inside a single-quoted PowerShell string.
        var check = code.IndexOf("DBCC CHECKDB (N''CSPS_RestoreDrill'') WITH NO_INFOMSGS, ALL_ERRORMSGS", StringComparison.Ordinal);

        check.ShouldBeGreaterThanOrEqualTo(0, "The script must run DBCC CHECKDB on the restored copy.");
        check.ShouldBeGreaterThan(restore, "DBCC CHECKDB runs after the restore.");
    }

    [Fact]
    public void ScriptComparesTheOwnersCountsAndMigration()
    {
        var code = CodeOnly(ReadScript());

        foreach (var table in new[] { "dbo.Orders", "dbo.AspNetUsers", "dbo.QuoteRequests" })
        {
            code.ShouldContain($"'{table}'", Case.Sensitive, $"The receipt must read the {table} row count.");
        }

        code.ShouldContain("Match");
        code.ShouldContain("Mismatch");
        code.ShouldContain("PSBoundParameters.ContainsKey('ExpectedOrders')");
        code.ShouldContain("PSBoundParameters.ContainsKey('ExpectedMigration')");
    }

    [Fact]
    public void ScriptWritesTheReceiptOnlyUnderTheGitIgnoredLocalFolder()
    {
        var code = CodeOnly(ReadScript());

        code.ShouldContain("restore-drill-receipt.md");
        code.ShouldNotContain(".planning", Case.Sensitive, "The receipt lists production table names and counts; it must not default to a tracked folder.");

        var defaultPath = code.IndexOf("restore-drill-receipt.md", StringComparison.Ordinal);
        var firstOpen = code.IndexOf(".Open()", StringComparison.Ordinal);
        defaultPath.ShouldBeLessThan(firstOpen, "The receipt path must be settled before any connection is opened.");
        code.ShouldContain("-ReceiptPath must be inside", Case.Sensitive, "A receipt inside the repository must be in the _local folder.");

        File.ReadAllLines(RepoRoot.PathOf(".gitignore")).ShouldContain("_local/", "_local/ must stay git-ignored.");
    }

    [Fact]
    public void RunbookHasItsSixSectionsInOrder()
    {
        var headings = RunbookHeading().Matches(ReadRunbook()).Select(match => match.Groups["title"].Value).ToList();

        headings.ShouldBe(
            [
                "Make the backup",
                "Restore it on this PC",
                "Check it",
                "Open the app against it",
                "Drop the copy",
                "What stays on this PC",
            ]);
    }

    [Fact]
    public void RunbookKeepsItsTimestampLineAndNamesTheOwner()
    {
        var runbook = ReadRunbook();

        TimestampLine().IsMatch(runbook).ShouldBeTrue("The runbook needs a '*Created: <ISO time> · Updated: <ISO time>*' line.");
        runbook.ShouldContain("the owner");
    }

    [Fact]
    public void RunbookKeepsTheMailSafetyAndVersionFacts()
    {
        var runbook = ReadRunbook();

        foreach (var phrase in new[]
                 {
                     "Restore-BackupDrill.ps1",
                     "smtp.invalid",
                     "-Drop",
                     "never the production certificate",
                     @"preflight.ps1 -Ports 5180,5115,7028,5199",
                     "RTM-CU3",
                     "17.0.4025.3",
                     "D-51",
                     "_local",
                 })
        {
            runbook.ShouldContain(phrase, Case.Sensitive, $"The runbook must say '{phrase}'.");
        }

        Section(runbook, "Open the app against it").ShouldContain("do not sign in");
        Section(runbook, "Drop the copy").ShouldContain("-Drop");
        File.Exists(RepoRoot.PathOf(ScriptPath)).ShouldBeTrue();
    }

    [Fact]
    public void RunbookHoldsNoSecretOrPersonalDetail()
    {
        foreach (var (pattern, sample) in PersonalDetailDetectors)
        {
            pattern.IsMatch(sample).ShouldBeTrue($"Detector {pattern} must catch: {sample}");
        }

        var found = PersonalDetailDetectors.Select(detector => detector.Pattern).Distinct()
            .SelectMany(pattern => pattern.Matches(ReadRunbook()).Select(match => match.Value))
            .ToList();

        found.ShouldBeEmpty("The runbook must never hold passwords, keys, emails, local user paths or long encoded values.");
    }

    // Each detector paired with a sample it must catch, so a broken pattern cannot pass silently.
    private static readonly (Regex Pattern, string Sample)[] PersonalDetailDetectors =
    [
        (PasswordAssignment(), "Server=x;Password = hunter2"),
        (PasswordAssignment(), "PWD=hunter2"),
        (UserIdAssignment(), "User ID=csps_owner;"),
        (PemBlock(), "-----BEGIN PRIVATE KEY-----"),
        (EmailAddress(), "someone@example.com"),
        (UserProfilePath(), "C:/Users/someone/"),
        (UserProfilePath(), @"C:\Users\someone\Desktop"),
        (LongEncodedValue(), new string('A', 220)),
    ];

    private static string ReadRunbook()
    {
        var path = RepoRoot.PathOf("docs/operations/backup-restore.md");
        File.Exists(path).ShouldBeTrue("docs/operations/backup-restore.md is missing.");
        return File.ReadAllText(path).ReplaceLineEndings("\n");
    }

    // The text of one "## " section, up to the next "## " heading.
    private static string Section(string runbook, string heading)
    {
        var match = Regex.Match(
            runbook, $@"^## {Regex.Escape(heading)}\s*$.*?(?=^## |\z)", RegexOptions.Multiline | RegexOptions.Singleline | RegexOptions.CultureInvariant);
        match.Success.ShouldBeTrue($"The runbook has no '## {heading}' section.");
        return match.Value;
    }

    private static string ReadScript()
    {
        var path = RepoRoot.PathOf(ScriptPath);
        File.Exists(path).ShouldBeTrue($"{ScriptPath} is missing.");
        return File.ReadAllText(path);
    }

    // The help block and comment lines describe the rules in words; only the code is judged.
    private static string CodeOnly(string script)
    {
        var withoutHelp = HelpBlock().Replace(script, string.Empty);
        var lines = withoutHelp.ReplaceLineEndings("\n").Split('\n')
            .Where(line => !line.TrimStart().StartsWith('#'));
        return string.Join('\n', lines);
    }

    private static string ParamBlock(string script)
    {
        var match = ParamSection().Match(CodeOnly(script));
        match.Success.ShouldBeTrue("The script has no param() block.");
        return match.Groups["body"].Value;
    }

    [GeneratedRegex(@"^## (?<title>.+?)\s*$", RegexOptions.CultureInvariant | RegexOptions.Multiline)]
    private static partial Regex RunbookHeading();

    [GeneratedRegex(
        @"^\*Created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2} · Updated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}\*\s*$",
        RegexOptions.CultureInvariant | RegexOptions.Multiline)]
    private static partial Regex TimestampLine();

    [GeneratedRegex(@"\b(password|pwd)\s*=", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex PasswordAssignment();

    [GeneratedRegex(@"\bUser\s*ID\s*=", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex UserIdAssignment();

    [GeneratedRegex("-----BEGIN", RegexOptions.CultureInvariant)]
    private static partial Regex PemBlock();

    [GeneratedRegex(@"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)+", RegexOptions.CultureInvariant)]
    private static partial Regex EmailAddress();

    [GeneratedRegex(@"[A-Za-z]:[\\/]Users[\\/]", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex UserProfilePath();

    // A pasted certificate or key would be a long run of base64 characters.
    [GeneratedRegex(@"[A-Za-z0-9+/]{200,}", RegexOptions.CultureInvariant)]
    private static partial Regex LongEncodedValue();

    [GeneratedRegex(@"<#.*?#>", RegexOptions.CultureInvariant | RegexOptions.Singleline)]
    private static partial Regex HelpBlock();

    [GeneratedRegex(@"param\((?<body>.*?)^\)", RegexOptions.CultureInvariant | RegexOptions.Singleline | RegexOptions.Multiline)]
    private static partial Regex ParamSection();

    [GeneratedRegex(@"^\s*(?:\[[^\]]+\])*\$(?<name>\w+)", RegexOptions.CultureInvariant | RegexOptions.Multiline)]
    private static partial Regex ParameterName();

    [GeneratedRegex(@"\$(Server|Database|ConnectionString|Instance|DataSource)\b", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex ForbiddenParameter();

    [GeneratedRegex(@"DROP\s+DATABASE\s+(?<name>[^\s;]+)", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex DropStatement();

    // Uppercase SQL keywords only: PowerShell code and messages use lowercase words.
    [GeneratedRegex(@"\b(?:FROM|JOIN)\s+(?<name>[\[\]\w.]+)", RegexOptions.CultureInvariant)]
    private static partial Regex SqlSource();
}

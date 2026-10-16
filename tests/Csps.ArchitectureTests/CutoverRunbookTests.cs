using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// Text rules for the cutover tooling (plan 03-14): the legacy receipt script may only restore into
/// CSPS_Legacy_Restore on the default LocalDB instance, may only read catalog metadata, and may only take a .bak
/// from the project's _local folder (D-04, threats T-03-52 to T-03-54).
/// </summary>
public sealed partial class CutoverRunbookTests
{
    private const string ReceiptScriptPath = "tools/scripts/Restore-LegacyReceipt.ps1";

    [Fact]
    public void ReceiptScriptHasFixedTargets()
    {
        var script = ReadScript();

        script.ShouldContain(@"(localdb)\MSSQLLocalDB");
        script.ShouldContain("CSPS_Legacy_Restore");

        var parameters = ParamBlock(script);
        ForbiddenParameter().Matches(parameters).Select(match => match.Value).ShouldBeEmpty(
            "The server and database are fixed in the script; they must never be parameters.");

        var drops = DropStatement().Matches(CodeOnly(script)).Select(match => match.Groups["name"].Value).ToList();
        drops.ShouldNotBeEmpty("The script must drop the restore target when -Replace is given.");
        drops.ShouldAllBe(name => string.Equals(name, "[CSPS_Legacy_Restore]", StringComparison.Ordinal));
    }

    [Fact]
    public void ReceiptScriptReadsMetadataOnly()
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
        sources.ShouldAllBe(
            name => name.Contains("sys.", StringComparison.Ordinal),
            "Every query may read only catalog views, never a user table.");
    }

    [Fact]
    public void ReceiptScriptKeepsTheBakLocal()
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
    }

    [Fact]
    public void ReceiptScriptValidatesTheBackupBeforeDroppingTheRestore()
    {
        var code = CodeOnly(ReadScript());

        var fileList = code.IndexOf("RESTORE FILELISTONLY", StringComparison.Ordinal);
        var verify = code.IndexOf("RESTORE VERIFYONLY", StringComparison.Ordinal);
        var drop = code.IndexOf("DROP DATABASE", StringComparison.Ordinal);

        fileList.ShouldBeGreaterThanOrEqualTo(0, "The script must read the backup's file list.");
        verify.ShouldBeGreaterThanOrEqualTo(0, "The script must verify the backup (RESTORE VERIFYONLY, which checks backup checksums).");
        drop.ShouldBeGreaterThan(0, "The script must drop the restore target when -Replace is given.");
        fileList.ShouldBeLessThan(drop, "The backup's file list must be read before the existing restore is dropped.");
        verify.ShouldBeLessThan(drop, "The backup must be verified before the existing restore is dropped.");
    }

    [Fact]
    public void ReceiptScriptWritesTheReceiptOnlyUnderTheGitIgnoredLocalFolder()
    {
        var code = CodeOnly(ReadScript());

        code.ShouldContain("legacy-receipt.md");
        code.ShouldNotContain(".planning", Case.Sensitive, "The receipt lists production table names and counts; it must not default to a tracked folder.");

        var defaultPath = code.IndexOf("legacy-receipt.md", StringComparison.Ordinal);
        var firstOpen = code.IndexOf(".Open()", StringComparison.Ordinal);
        defaultPath.ShouldBeLessThan(firstOpen, "The receipt path must be settled before any connection is opened.");
        code.ShouldContain("-ReceiptPath must be inside", Case.Sensitive, "A receipt inside the repository must be in the _local folder.");

        File.ReadAllLines(RepoRoot.PathOf(".gitignore")).ShouldContain("_local/", "_local/ must stay git-ignored.");

        var runbook = ReadRunbook();
        runbook.ShouldContain("_local/legacy-receipt.md");
        runbook.ShouldNotContain("03-LEGACY-RECEIPT", Case.Sensitive, "The runbook must not send the receipt to a tracked folder.");
    }

    [Fact]
    public void RunbookHasTheEightStepsInOrder()
    {
        var runbook = ReadRunbook();

        var headings = StepHeading().Matches(runbook).Select(match => match.Groups["number"].Value).ToList();
        string.Join(",", headings).ShouldBe("1,2,3,4,5,6,7,8", "The runbook needs '## Step 1' to '## Step 8', once each, in order.");

        for (var number = 1; number <= 8; number++)
        {
            var section = Step(runbook, number);
            foreach (var label in new[] { "Who", "Paste back", "Claude checks", "Stop if" })
            {
                Regex.IsMatch(section, $@"^\*\*{label}:\*\*", RegexOptions.Multiline | RegexOptions.CultureInvariant)
                    .ShouldBeTrue($"Step {number} has no '**{label}:**' line.");
            }
        }

        runbook.ShouldContain("point of no return");
        Step(runbook, 3).ShouldContain("point of no return");
        Step(runbook, 3).ShouldContain("SELECT name, compatibility_level, collation_name FROM sys.databases WHERE name = DB_NAME();");
    }

    [Fact]
    public void RunbookNamesEveryHostSetting()
    {
        var runbook = ReadRunbook();
        var sections = OptionSections();

        foreach (var variable in HostSettings)
        {
            runbook.Contains($"`{variable}`", StringComparison.Ordinal).ShouldBeTrue($"The runbook must name the host setting {variable}.");

            if (variable == "AllowedHosts")
            {
                File.ReadAllText(RepoRoot.PathOf("src/Csps.Server/appsettings.json"))
                    .Contains("\"AllowedHosts\"", StringComparison.Ordinal).ShouldBeTrue("AllowedHosts is no longer in appsettings.json.");
                continue;
            }

            var parts = variable.Split("__");
            parts.Length.ShouldBe(2, $"{variable} must look like Section__Name.");
            if (parts[0] == "ConnectionStrings")
            {
                ConnectionStringKey().Matches(AllSource()).Select(match => match.Groups["key"].Value)
                    .Contains($"ConnectionStrings:{parts[1]}").ShouldBeTrue($"No src/ code reads {variable}.");
                continue;
            }

            sections.ContainsKey(parts[0]).ShouldBeTrue($"No options class in src/ has the section name '{parts[0]}' ({variable}).");
            Regex.IsMatch(sections[parts[0]], $@"public\s+[\w<>?\[\]]+\s+{parts[1]}\s*\{{")
                .ShouldBeTrue($"The '{parts[0]}' options have no property '{parts[1]}' ({variable}).");
        }
    }

    [Fact]
    public void RunbookLinksItsDocs()
    {
        var runbook = ReadRunbook();

        foreach (var target in new[]
                 {
                     "deploy.md", "bootstrap-manager.md", "data-protection-rotation.md", "mail-setup.md",
                     "tools/scripts/Restore-LegacyReceipt.ps1",
                 })
        {
            runbook.Contains(target, StringComparison.Ordinal).ShouldBeTrue($"The runbook must link {target}.");
        }

        foreach (var doc in new[] { "deploy.md", "bootstrap-manager.md", "data-protection-rotation.md", "mail-setup.md" })
        {
            File.Exists(RepoRoot.PathOf($"docs/operations/{doc}")).ShouldBeTrue($"docs/operations/{doc} is missing.");
        }
    }

    [Fact]
    public void RunbookHoldsNoSecret()
    {
        foreach (var (pattern, sample) in SecretDetectors)
        {
            pattern.IsMatch(sample).ShouldBeTrue($"Detector {pattern} must catch: {sample}");
        }

        var found = SecretDetectors.Select(detector => detector.Pattern).Distinct()
            .SelectMany(pattern => pattern.Matches(ReadRunbook()).Select(match => match.Value))
            .ToList();

        found.ShouldBeEmpty("The runbook must never hold passwords, user ids, account keys, private keys, probe keys or long encoded values.");
    }

    [Fact]
    public void RunbookSwitchesThePoolOnlyAfterTheLegacySiteIsRetired()
    {
        var runbook = ReadRunbook();

        foreach (var number in new[] { 1, 2, 3, 5, 6, 7, 8 })
        {
            Step(runbook, number).Contains("Change to .Net Core", StringComparison.Ordinal).ShouldBeFalse($"Step {number} must not switch the pool.");
        }

        var step4 = Step(runbook, 4);
        foreach (var fact in new[] { "Change to .Net Core", "No Managed Code", "64-bit", "Load User Profile" })
        {
            step4.Contains(fact, StringComparison.Ordinal).ShouldBeTrue($"Step 4 must mention: {fact}.");
        }

        var rollback = Section(runbook, "If something goes wrong");
        rollback.ShouldContain("Change to ASP.NET 4.X");
        rollback.ShouldContain("32-bit");
    }

    [Fact]
    public void RunbookNamesBothSiteAddresses()
    {
        ReadRunbook().ShouldContain("cspstailoring.com;www.cspstailoring.com");
    }

    private static readonly string[] HostSettings =
    [
        "ConnectionStrings__Csps", "Jwt__SigningKey", "Auth__CodeMacKey", "DataProtection__CertificateBase64",
        "DataProtection__CertificatePassword", "Smtp__Host", "Smtp__Port", "Smtp__Security", "Smtp__UserName",
        "Smtp__Password", "App__PublicBaseUrl", "AllowedHosts",
    ];

    // Each detector paired with a sample it must catch, so a broken pattern cannot pass silently.
    private static readonly (Regex Pattern, string Sample)[] SecretDetectors =
    [
        (PasswordAssignment(), "Server=x;Password = hunter2"),
        (PasswordAssignment(), "PWD=hunter2"),
        (UserIdAssignment(), "User ID=csps_owner;"),
        (AccountKeyAssignment(), "AccountKey=abc123"),
        (PemBlock(), "-----BEGIN PRIVATE KEY-----"),
        (ProbeKeyValue(), "curl -H \"X-Probe-Key: 0123456789abcdef\" https://probe.example/probe"),
        (LongEncodedValue(), new string('A', 220)),
    ];

    private static string ReadRunbook()
    {
        var path = RepoRoot.PathOf("docs/operations/cutover-runbook.md");
        File.Exists(path).ShouldBeTrue("docs/operations/cutover-runbook.md is missing.");
        return File.ReadAllText(path).ReplaceLineEndings("\n");
    }

    // The text of one "## Step N" section, up to the next "## " heading.
    private static string Step(string runbook, int number) => Section(runbook, $"Step {number}");

    private static string Section(string runbook, string headingStart)
    {
        var match = Regex.Match(
            runbook, $@"^## {Regex.Escape(headingStart)}\b.*?(?=^## |\z)", RegexOptions.Multiline | RegexOptions.Singleline | RegexOptions.CultureInvariant);
        match.Success.ShouldBeTrue($"The runbook has no '## {headingStart}' section.");
        return match.Value;
    }

    private static string AllSource() => string.Join('\n', SourceFiles().Select(File.ReadAllText));

    private static IEnumerable<string> SourceFiles() =>
        Directory.EnumerateFiles(RepoRoot.PathOf("src"), "*.cs", SearchOption.AllDirectories)
            .Where(file => !file.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
                && !file.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal));

    // Section name -> the text of the file that declares it, so a setting's property can be checked by name.
    private static Dictionary<string, string> OptionSections()
    {
        var sections = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var file in SourceFiles())
        {
            var text = File.ReadAllText(file);
            foreach (Match match in SectionConstant().Matches(text))
            {
                var name = match.Groups["name"].Value;
                sections[name] = sections.TryGetValue(name, out var existing) ? existing + "\n" + text : text;
            }
        }

        return sections;
    }

    private static string ReadScript()
    {
        var path = RepoRoot.PathOf(ReceiptScriptPath);
        File.Exists(path).ShouldBeTrue($"{ReceiptScriptPath} is missing.");
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

    [GeneratedRegex(@"^## Step (?<number>\d+)\b", RegexOptions.CultureInvariant | RegexOptions.Multiline)]
    private static partial Regex StepHeading();

    [GeneratedRegex(@"public\s+const\s+string\s+SectionName\s*=\s*""(?<name>[A-Za-z]+)""", RegexOptions.CultureInvariant)]
    private static partial Regex SectionConstant();

    [GeneratedRegex(@"ConnectionStringKey\s*=\s*""(?<key>[^""]+)""", RegexOptions.CultureInvariant)]
    private static partial Regex ConnectionStringKey();

    [GeneratedRegex(@"\b(password|pwd)\s*=", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex PasswordAssignment();

    [GeneratedRegex(@"\bUser\s*ID\s*=", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex UserIdAssignment();

    [GeneratedRegex(@"\bAccountKey\s*=", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex AccountKeyAssignment();

    [GeneratedRegex("-----BEGIN", RegexOptions.CultureInvariant)]
    private static partial Regex PemBlock();

    // A real key value after the header name. Angle-bracket placeholders such as <your-probe-key> do not match.
    [GeneratedRegex(@"X-Probe-Key\s*:\s*[A-Za-z0-9+/=_\-]{8,}", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex ProbeKeyValue();

    // A pasted certificate or key would be a long run of base64 characters.
    [GeneratedRegex(@"[A-Za-z0-9+/]{200,}", RegexOptions.CultureInvariant)]
    private static partial Regex LongEncodedValue();

    [GeneratedRegex(@"<#.*?#>", RegexOptions.CultureInvariant | RegexOptions.Singleline)]
    private static partial Regex HelpBlock();

    [GeneratedRegex(@"param\((?<body>.*?)^\)", RegexOptions.CultureInvariant | RegexOptions.Singleline | RegexOptions.Multiline)]
    private static partial Regex ParamSection();

    [GeneratedRegex(@"\$(Server|Database|ConnectionString|Instance|DataSource)\b", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex ForbiddenParameter();

    [GeneratedRegex(@"DROP\s+DATABASE\s+(?<name>[^\s;]+)", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex DropStatement();

    // Uppercase SQL keywords only: PowerShell code and messages use lowercase words.
    [GeneratedRegex(@"\b(?:FROM|JOIN)\s+(?<name>[\[\]\w.]+)", RegexOptions.CultureInvariant)]
    private static partial Regex SqlSource();
}

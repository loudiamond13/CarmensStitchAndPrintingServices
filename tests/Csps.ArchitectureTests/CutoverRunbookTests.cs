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

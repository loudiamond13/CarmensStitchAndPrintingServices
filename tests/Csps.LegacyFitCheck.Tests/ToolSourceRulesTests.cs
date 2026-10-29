using System.Text.RegularExpressions;

namespace Csps.LegacyFitCheck.Tests;

/// <summary>
/// The fit check holds no hand-written SQL (owner rule, D-50) and no EF logging hooks (D-02, T-07.1-06). Every C# file under
/// tools/Csps.LegacyFitCheck is scanned. Reading the command text EF generated is allowed, because the read-only guard needs it;
/// assigning it is not.
/// </summary>
public sealed partial class ToolSourceRulesTests
{
    private const string ToolFolder = "tools/Csps.LegacyFitCheck";

    private static readonly string[] BannedTokens =
    [
        "ExecuteSql",
        "FromSql",
        "SqlQuery",
        "new SqlCommand",
        "ExecuteNonQuery",
        "ExecuteScalar",
        "EnableSensitiveDataLogging",
        "LogTo(",
        "LoggerFactory",
    ];

    private static readonly string[] CommentPrefixes = ["//", "/*", "*"];

    [Fact]
    public void NoToolFileHoldsHandWrittenSqlOrLogging()
    {
        var root = FindRepoRoot();
        var toolRoot = Path.Combine(root, ToolFolder);
        Directory.Exists(toolRoot).ShouldBeTrue();

        var files = Directory.EnumerateFiles(toolRoot, "*.cs", SearchOption.AllDirectories)
            .Where(file => IsScanned(Path.GetRelativePath(toolRoot, file).Replace('\\', '/')))
            .ToList();
        files.ShouldNotBeEmpty();

        var offenders = files
            .SelectMany(file =>
            {
                var relative = Path.GetRelativePath(toolRoot, file).Replace(Path.DirectorySeparatorChar, '/');
                return FileOffences(File.ReadLines(file), relative).Select(offence => $"{relative}: {offence}");
            })
            .ToList();

        offenders.ShouldBeEmpty("The tool holds no raw SQL and no EF logging hooks.");
    }

    [Fact]
    public void TheRunnerNeverCommitsTheReadTransaction()
    {
        var runner = File.ReadAllText(Path.Combine(FindRepoRoot(), ToolFolder, "FitCheckRunner.cs"));

        runner.ShouldContain("BeginTransactionAsync");
        runner.ShouldNotContain("CommitAsync");
        runner.ShouldNotContain(".Commit(");
    }

    [Theory]
    [InlineData("await context.Database.ExecuteSqlRawAsync(\"DELETE FROM X\", ct);")]
    [InlineData("var rows = context.Orders.FromSqlRaw(\"SELECT * FROM Orders\");")]
    [InlineData("var ids = context.Database.SqlQuery<int>($\"SELECT Id FROM X\");")]
    [InlineData("command.CommandText = sql;")]
    [InlineData("command.CommandText=sql;")]
    [InlineData("command.CommandText += \" OR 1 = 1\";")]
    [InlineData("var command = new SqlCommand(sql, connection);")]
    [InlineData("var count = command.ExecuteNonQueryAsync(ct);")]
    [InlineData("var count = command.ExecuteScalar();")]
    [InlineData("builder.EnableSensitiveDataLogging();")]
    [InlineData("builder.LogTo(Console.WriteLine);")]
    [InlineData("builder.UseLoggerFactory(factory);")]
    [InlineData("SqlCommand command = new(sql, connection);")]
    [InlineData("var command = new Microsoft.Data.SqlClient.SqlCommand(sql, connection);")]
    [InlineData("var command = connection.CreateCommand();")]
    [InlineData("var command = context.Database.GetDbConnection().CreateCommand();")]
    [InlineData("var reader = command.ExecuteReader();")]
    [InlineData("await using var reader = await command.ExecuteReaderAsync(ct);")]
    [InlineData("private static void Run(DbCommand command)")]
    [InlineData("await using var connection = new SqlConnection(text);")]
    [InlineData("SqlConnection connection = new(text);")]
    public void TheScannerFlagsEachBannedLine(string line) => FileOffences([line], "Checks/Sample.cs").ShouldNotBeEmpty();

    [Theory]
    [InlineData("var allowed = ReadOnlyCommandGuard.IsAllowedRead(eventData.CommandSource, command.CommandText);")]
    [InlineData("if (command.CommandText == \"x\")")]
    [InlineData("var text = command.CommandText;")]
    [InlineData("var rows = await context.Orders.Where(row => row.OrderId == id).ToListAsync(ct);")]
    [InlineData("await context.Orders.ExecuteDeleteAsync(ct);")]
    [InlineData("    // The old code assigned CommandText and used ExecuteSqlRaw.")]
    [InlineData("    /// <summary>Never call FromSql or LogTo(.</summary>")]
    [InlineData("SqlConnection.ClearAllPools();")]
    [InlineData("var builder = new SqlConnectionStringBuilder(text);")]
    public void TheScannerAllowsReadsAndComments(string line) => FileOffences([line], "Checks/Sample.cs").ShouldBeEmpty();

    [Fact]
    public void OnlyTheReadOnlyGuardMayNameDbCommand()
    {
        const string GuardLine = "public override InterceptionResult<int> NonQueryExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<int> result) =>";

        FileOffences([GuardLine], "Source/ReadOnlyCommandGuard.cs").ShouldBeEmpty();
        FileOffences([GuardLine], "Source/LegacySource.cs").ShouldNotBeEmpty();
        FileOffences(["var command = connection.CreateCommand();"], "Source/ReadOnlyCommandGuard.cs").ShouldNotBeEmpty();
    }

    [Fact]
    public void ABlockCommentIsSkippedButALineStartingWithAStarOutsideOneIsScanned()
    {
        FileOffences(["/*", "     * ExecuteScalar is banned", "     */"], "Checks/Sample.cs").ShouldBeEmpty();
        FileOffences(["var total = factor", "    * (int)command.ExecuteScalar();"], "Checks/Sample.cs").ShouldNotBeEmpty();
        FileOffences(["/* note */ var count = command.ExecuteScalar();"], "Checks/Sample.cs").ShouldNotBeEmpty();
        FileOffences(["/*", " note", " */ var count = command.ExecuteScalar();"], "Checks/Sample.cs").ShouldNotBeEmpty();
    }

    [GeneratedRegex(@"\bCommandText\s*[-+*/]?=(?![=>])", RegexOptions.CultureInvariant)]
    private static partial Regex CommandTextAssignment();

    // Scans the lines of one file.
    private static IEnumerable<string> FileOffences(IEnumerable<string> lines, string relativePath)
    {
        _ = relativePath;
        return lines.SelectMany(Offences);
    }

    // A comment-only line is skipped, so documentation may name the banned calls.
    private static IEnumerable<string> Offences(string line)
    {
        var trimmed = line.TrimStart();
        if (CommentPrefixes.Any(prefix => trimmed.StartsWith(prefix, StringComparison.Ordinal)))
        {
            return [];
        }

        var found = BannedTokens.Where(token => line.Contains(token, StringComparison.Ordinal)).ToList();
        if (CommandTextAssignment().IsMatch(line))
        {
            found.Add("CommandText assignment");
        }

        return found;
    }

    private static bool IsScanned(string relativePath)
    {
        var segments = relativePath.Split('/');
        return !segments.Contains("bin", StringComparer.OrdinalIgnoreCase) && !segments.Contains("obj", StringComparer.OrdinalIgnoreCase);
    }

    private static string FindRepoRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Csps.slnx")))
            {
                return directory.FullName;
            }
        }

        throw new InvalidOperationException("The repository root (Csps.slnx) was not found.");
    }
}

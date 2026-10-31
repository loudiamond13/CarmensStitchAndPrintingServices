using System.Text.RegularExpressions;

namespace Csps.LegacyFitCheck.Tests;

/// <summary>
/// The fit check holds no hand-written SQL (owner rule, D-50) and no EF logging hooks (D-02, T-07.1-06). Every C# file under
/// tools/Csps.LegacyFitCheck is scanned. Reading the command text EF generated is allowed, because the read-only guard needs it;
/// assigning it is not. Raw commands and connections are banned in every form, and only the read-only guard may name DbCommand.
/// </summary>
public sealed partial class ToolSourceRulesTests
{
    private const string ToolFolder = "tools/Csps.LegacyFitCheck";
    private const string GuardFile = "Source/ReadOnlyCommandGuard.cs";

    private static readonly string[] BannedTokens =
    [
        "ExecuteSql",
        "FromSql",
        "SqlQuery",
        "SqlCommand",
        "CreateCommand(",
        "ExecuteReader",
        "ExecuteNonQuery",
        "ExecuteScalar",
        "EnableSensitiveDataLogging",
        "LogTo(",
        "LoggerFactory",
    ];

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

    // A raw connection in any form. Clearing the pools and the connection string builder are allowed.
    [GeneratedRegex(@"\bSqlConnection\b(?!\.ClearAllPools\b)", RegexOptions.CultureInvariant)]
    private static partial Regex RawConnection();

    [GeneratedRegex(@"\bDbCommand\b", RegexOptions.CultureInvariant)]
    private static partial Regex DbCommandType();

    // Scans the lines of one file. Line comments and block comments are skipped, so documentation may name the banned calls.
    private static List<string> FileOffences(IEnumerable<string> lines, string relativePath)
    {
        var found = new List<string>();
        var inBlock = false;
        foreach (var line in lines)
        {
            var code = line.TrimStart();
            if (!inBlock && code.StartsWith("/*", StringComparison.Ordinal))
            {
                inBlock = true;
                code = code[2..];
            }

            if (inBlock)
            {
                var end = code.IndexOf("*/", StringComparison.Ordinal);
                if (end < 0)
                {
                    continue;
                }

                inBlock = false;
                code = code[(end + 2)..].TrimStart();
            }

            if (code.Length == 0 || code.StartsWith("//", StringComparison.Ordinal))
            {
                continue;
            }

            found.AddRange(Offences(code, relativePath));
        }

        return found;
    }

    private static List<string> Offences(string code, string relativePath)
    {
        var found = BannedTokens.Where(token => code.Contains(token, StringComparison.Ordinal)).ToList();
        if (CommandTextAssignment().IsMatch(code))
        {
            found.Add("CommandText assignment");
        }

        if (RawConnection().IsMatch(code))
        {
            found.Add("SqlConnection");
        }

        if (DbCommandType().IsMatch(code) && relativePath != GuardFile)
        {
            found.Add("DbCommand");
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

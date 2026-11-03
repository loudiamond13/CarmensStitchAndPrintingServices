using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// Owner rule (no inline SQL), PERF-04, T-06-36: application code reaches the database through EF's own API (LINQ,
/// <c>ExecuteUpdate</c>, <c>ExecuteDelete</c>, row versions), never through hand-written SQL. Generated migrations are the one
/// exception. Every C# file under <c>src/</c> and the host probe is scanned for the raw SQL entry points.
/// </summary>
public sealed partial class NoInlineSqlTests
{
    private const string BackupFile = "Csps.Infrastructure/Maintenance/SqlServerBackupStatement.cs";

    // The one file the owner approved by name (D-40, D-50): the monthly backup statement. Nothing else may hold raw SQL.
    private static readonly string[] AllowedFiles = [BackupFile];

    private static readonly string[] SqlKeywords =
        ["SELECT", "INSERT", "UPDATE", "DELETE", "MERGE", "EXEC", "DROP", "ALTER", "CREATE", "GRANT", "RESTORE", "TRUNCATE"];

    private static readonly string[] RawSqlTokens =
    [
        "ExecuteSql",
        "FromSql",
        "SqlQuery",
        "CommandText",
        "new SqlCommand",
        "ExecuteNonQuery",
        "ExecuteScalar",
        "CreateCommand",
        "ExecuteReader",
        "BACKUP ",
        "RESTORE ",
    ];

    private static readonly string[] CommentPrefixes = ["//", "/*", "*"];

    [Fact]
    public void NoSourceFileHoldsInlineSqlOutsideMigrations()
    {
        var sourceRoot = RepoRoot.PathOf("src");
        var offenders = new List<string>();

        foreach (var file in SourceFiles(sourceRoot))
        {
            var relative = RelativePath(sourceRoot, file);
            if (AllowedFiles.Contains(relative, StringComparer.Ordinal))
            {
                continue;
            }

            offenders.AddRange(File.ReadLines(file).SelectMany(Offences).Select(offence => $"{relative}: {offence}"));
        }

        offenders.ShouldBeEmpty("Inline SQL is allowed only in generated migrations and the one approved backup file (D-40, D-50).");
    }

    [Fact]
    public void TheHostProbeHoldsNoRawSqlAndNoFileIsAllowed()
    {
        var probeRoot = RepoRoot.PathOf("tools/Csps.HostProbe");
        var offenders = new List<string>();

        foreach (var file in SourceFiles(probeRoot))
        {
            var relative = RelativePath(probeRoot, file);
            offenders.AddRange(File.ReadLines(file).SelectMany(Offences).Select(offence => $"{relative}: {offence}"));
        }

        offenders.ShouldBeEmpty("The probe runs the job's own statement and holds no SQL of its own (D-40).");
    }

    [Fact]
    public void OnlyTheBackupStatementFileIsAllowedInlineSql() =>
        AllowedFiles.ShouldBe([BackupFile], "The owner approved this one file by name (D-40). Rebuild any other code with EF's own API.");

    [Fact]
    public void TheBackupFileHoldsExactlyTheOneApprovedStatement()
    {
        var text = File.ReadAllText(RepoRoot.PathOf("src/" + BackupFile));
        var literals = StringLiterals(text).ToList();

        var backupLiterals = literals.Where(literal => literal.Contains("BACKUP DATABASE", StringComparison.Ordinal)).ToList();
        backupLiterals.Count.ShouldBe(1);
        backupLiterals[0].ShouldBe("BACKUP DATABASE @database TO DISK = @path WITH COPY_ONLY, CHECKSUM, FORMAT, INIT");

        var others = literals.Where(literal => !literal.Contains("BACKUP DATABASE", StringComparison.Ordinal));
        others.Where(NamesAnSqlKeyword).ShouldBeEmpty("No other literal in the backup file may name an SQL keyword.");
        string[] interpolated = ["$\"", "$@\"", "@$\""];
        interpolated.Where(marker => text.Contains(marker, StringComparison.Ordinal)).ShouldBeEmpty("No interpolated strings: the SQL text is never built from values.");
    }

    [Theory]
    [InlineData("await context.Database.ExecuteSqlRawAsync(\"DELETE FROM X\", ct);")]
    [InlineData("await context.Database.ExecuteSqlInterpolatedAsync($\"DELETE FROM X WHERE Id = {id}\", ct);")]
    [InlineData("var rows = context.Users.FromSqlRaw(\"SELECT * FROM AspNetUsers\");")]
    [InlineData("var ids = context.Database.SqlQuery<Guid>($\"SELECT Id FROM X\");")]
    [InlineData("command.CommandText = sql;")]
    [InlineData("var command = new SqlCommand(sql, connection);")]
    [InlineData("var count = command.ExecuteNonQueryAsync(ct);")]
    [InlineData("var count = command.ExecuteScalar();")]
    [InlineData("var command = connection.CreateCommand();")]
    [InlineData("var reader = await command.ExecuteReaderAsync(ct);")]
    [InlineData("const string Sql = \"BACKUP DATABASE X TO DISK = 'y'\";")]
    [InlineData("const string Sql = \"RESTORE DATABASE X FROM DISK = 'y'\";")]
    public void TheScannerFlagsEachRawSqlEntryPoint(string line) => Offences(line).ShouldNotBeEmpty();

    [Theory]
    [InlineData("var rows = await context.Users.Where(user => user.IsActive).ToListAsync(ct);")]
    [InlineData("await context.Expenses.Where(row => row.Id == id).ExecuteUpdateAsync(set => set.SetProperty(row => row.Name, name), ct);")]
    [InlineData("await context.Expenses.Where(row => row.Id == id).ExecuteDeleteAsync(ct);")]
    [InlineData("    // The old code used ExecuteSqlRaw here.")]
    [InlineData("    /// <summary>Never use FromSql or CommandText.</summary>")]
    [InlineData("     * ExecuteScalar is banned")]
    [InlineData("    // BACKUP DATABASE lives only in the one approved file.")]
    public void TheScannerAllowsEfApiCallsAndComments(string line) => Offences(line).ShouldBeEmpty();

    [Theory]
    [InlineData("Csps.Infrastructure/Persistence/Migrations/20261025121237_AddCompanyExpenses.cs", false)]
    [InlineData("Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs", false)]
    [InlineData("Csps.Infrastructure/bin/Debug/net10.0/Generated.cs", false)]
    [InlineData("Csps.Infrastructure/obj/Debug/net10.0/Generated.cs", false)]
    [InlineData("Csps.Infrastructure/Persistence/CspsDbContext.cs", true)]
    [InlineData("Csps.Infrastructure/Idempotency/IdempotencyGate.cs", true)]
    [InlineData("Csps.Infrastructure/Identity/AccountTokenStore.cs", true)]
    [InlineData("Csps.Infrastructure/Identity/ManagerRosterLock.cs", true)]
    public void OnlyMigrationsAndBuildOutputAreSkipped(string relativePath, bool scanned) => IsScanned(relativePath).ShouldBe(scanned);

    // Plain text search per line. A line that is only a comment is skipped so documentation may name the banned calls.
    private static IEnumerable<string> Offences(string line)
    {
        var trimmed = line.TrimStart();
        if (CommentPrefixes.Any(prefix => trimmed.StartsWith(prefix, StringComparison.Ordinal)))
        {
            return [];
        }

        return RawSqlTokens.Where(token => line.Contains(token, StringComparison.Ordinal));
    }

    // Paths are relative to src and use forward slashes. Generated migrations and build output are not scanned.
    private static bool IsScanned(string relativePath)
    {
        var segments = relativePath.Split('/');
        return !segments.Contains("bin", StringComparer.OrdinalIgnoreCase)
            && !segments.Contains("obj", StringComparer.OrdinalIgnoreCase)
            && !relativePath.Contains("/Persistence/Migrations/", StringComparison.Ordinal);
    }

    private static IEnumerable<string> StringLiterals(string text) =>
        StringLiteral().Matches(text).Select(match => match.Groups[1].Value);

    private static bool NamesAnSqlKeyword(string literal) =>
        SqlKeywords.Any(keyword => Regex.IsMatch(literal, @"\b" + keyword + @"\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant));

    // A plain or escaped string literal on one line (the backup file has no verbatim or raw strings).
    [GeneratedRegex(@"""((?:[^""\\\r\n]|\\.)*)""")]
    private static partial Regex StringLiteral();

    private static string RelativePath(string sourceRoot, string file) =>
        Path.GetRelativePath(sourceRoot, file).Replace('\\', '/');

    private static IEnumerable<string> SourceFiles(string sourceRoot) =>
        Directory.EnumerateFiles(sourceRoot, "*.cs", SearchOption.AllDirectories)
            .Where(file => IsScanned(RelativePath(sourceRoot, file)));
}

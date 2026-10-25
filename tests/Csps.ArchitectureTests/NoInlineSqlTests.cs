namespace Csps.ArchitectureTests;

/// <summary>
/// Owner rule (no inline SQL), PERF-04, T-06-36: application code reaches the database through EF's own API (LINQ,
/// <c>ExecuteUpdate</c>, <c>ExecuteDelete</c>, row versions), never through hand-written SQL. Generated migrations are the one
/// exception. Every C# file under <c>src/</c> is scanned for the raw SQL entry points.
/// </summary>
public sealed class NoInlineSqlTests
{
    // Pending the owner: each of these three takes a SQL Server application lock (sp_getapplock) that EF has no API for.
    // The owner allows inline SQL only where approved by name, so the question waits in the STATE.md Owner backlog.
    // Do not add a file here without the owner's approval by name.
    private static readonly string[] AllowedFiles =
    [
        "Csps.Infrastructure/Idempotency/IdempotencyGate.cs",
        "Csps.Infrastructure/Identity/AccountTokenStore.cs",
        "Csps.Infrastructure/Identity/ManagerRosterLock.cs",
    ];

    private static readonly string[] RawSqlTokens =
    [
        "ExecuteSql",
        "FromSql",
        "SqlQuery",
        "CommandText",
        "new SqlCommand",
        "ExecuteNonQuery",
        "ExecuteScalar",
    ];

    private static readonly string[] CommentPrefixes = ["//", "/*", "*"];

    [Fact]
    public void NoSourceFileHoldsInlineSqlOutsideMigrationsAndTheReviewedFiles()
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

        offenders.ShouldBeEmpty("Inline SQL is allowed only in generated migrations and the files the owner approved by name.");
    }

    [Fact]
    public void EveryAllowedFileStillHoldsInlineSql()
    {
        var sourceRoot = RepoRoot.PathOf("src");

        foreach (var relative in AllowedFiles)
        {
            var path = Path.Combine(sourceRoot, relative.Replace('/', Path.DirectorySeparatorChar));
            File.Exists(path).ShouldBeTrue($"{relative} is on the allow-list but does not exist.");
            File.ReadLines(path).SelectMany(Offences).ShouldNotBeEmpty($"{relative} is on the allow-list but holds no inline SQL. Remove the stale entry.");
        }
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
    public void TheScannerFlagsEachRawSqlEntryPoint(string line) => Offences(line).ShouldNotBeEmpty();

    [Theory]
    [InlineData("var rows = await context.Users.Where(user => user.IsActive).ToListAsync(ct);")]
    [InlineData("await context.Expenses.Where(row => row.Id == id).ExecuteUpdateAsync(set => set.SetProperty(row => row.Name, name), ct);")]
    [InlineData("await context.Expenses.Where(row => row.Id == id).ExecuteDeleteAsync(ct);")]
    [InlineData("    // The old code used ExecuteSqlRaw here.")]
    [InlineData("    /// <summary>Never use FromSql or CommandText.</summary>")]
    [InlineData("     * ExecuteScalar is banned")]
    public void TheScannerAllowsEfApiCallsAndComments(string line) => Offences(line).ShouldBeEmpty();

    [Theory]
    [InlineData("Csps.Infrastructure/Persistence/Migrations/20261025121237_AddCompanyExpenses.cs", false)]
    [InlineData("Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs", false)]
    [InlineData("Csps.Infrastructure/bin/Debug/net10.0/Generated.cs", false)]
    [InlineData("Csps.Infrastructure/obj/Debug/net10.0/Generated.cs", false)]
    [InlineData("Csps.Infrastructure/Persistence/CspsDbContext.cs", true)]
    [InlineData("Csps.Infrastructure/Idempotency/IdempotencyGate.cs", true)]
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

    private static string RelativePath(string sourceRoot, string file) =>
        Path.GetRelativePath(sourceRoot, file).Replace('\\', '/');

    private static IEnumerable<string> SourceFiles(string sourceRoot) =>
        Directory.EnumerateFiles(sourceRoot, "*.cs", SearchOption.AllDirectories)
            .Where(file => IsScanned(RelativePath(sourceRoot, file)));
}

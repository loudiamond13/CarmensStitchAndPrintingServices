namespace Csps.ArchitectureTests;

/// <summary>
/// Owner rule (no inline SQL), PERF-04, T-06-36: application code reaches the database through EF's own API (LINQ,
/// <c>ExecuteUpdate</c>, <c>ExecuteDelete</c>, row versions), never through hand-written SQL. Generated migrations are the one
/// exception. Every C# file under <c>src/</c> is scanned for the raw SQL entry points.
/// </summary>
public sealed class NoInlineSqlTests
{
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
}

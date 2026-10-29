using Csps.LegacyFitCheck.Tests.Fakes;
using Csps.LegacyFitCheck.Trial;
using Csps.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.LegacyFitCheck.Tests;

public sealed class FitCheckRunnerTests
{
    [Fact]
    public async Task OneLegacyOrderRunsEndToEndAndTheTrialDatabaseIsGone()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = Path.Combine(Path.GetTempPath(), $"csps-fitcheck-{Guid.NewGuid():N}", "_local");
            var time = new FakeTimeProvider(new DateTimeOffset(2026, 10, 29, 0, 0, 0, TimeSpan.Zero));
            using var output = new StringWriter();
            using var error = new StringWriter();
            string? trialName = null;
            var hooks = new FitCheckHooks((name, _) =>
            {
                trialName = name;
                return Task.CompletedTask;
            });

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, time, output, error, token, hooks);

                exit.ShouldBe(0, error.ToString());
                output.ToString().ShouldContain("Orders checked: 1.");
                output.ToString().ShouldContain("_local/legacy-fit-check/findings-");
                output.ToString().ShouldNotContain("SENTINEL");
                error.ToString().ShouldNotContain("SENTINEL");

                var file = Directory.EnumerateFiles(Path.Combine(localRoot, "legacy-fit-check"), "findings-*.md").ShouldHaveSingleItem();
                var lines = await File.ReadAllLinesAsync(file, token);
                lines[1].ShouldStartWith("*Created: ");
                var text = string.Join('\n', lines);
                text.ShouldContain("Never commit");
                text.ShouldContain("import.imported");
                text.ShouldNotContain("TrialImport");

                trialName.ShouldNotBeNull();
                (await TrialDatabase.ExistsAsync(server.MasterConnectionString, trialName, token)).ShouldBeFalse();
                (await fake.CountAsync(token)).ShouldBe((1, 2));
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task TheFindingsRecordUnchangedWriteEvidence()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = NewLocalRoot();
            using var output = new StringWriter();
            using var error = new StringWriter();

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, token);

                exit.ShouldBe(0, error.ToString());
                var file = Directory.EnumerateFiles(Path.Combine(localRoot, "legacy-fit-check"), "findings-*.md").ShouldHaveSingleItem();
                var text = await File.ReadAllTextAsync(file, token);
                text.ShouldContain("Write evidence: unchanged (4 tables, 5 rows,");
                output.ToString().ShouldNotContain("Write evidence");
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task ARunWhoseRestoreChangedFails()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = NewLocalRoot();
            using var output = new StringWriter();
            using var error = new StringWriter();
            var hooks = new FitCheckHooks(BetweenEvidence: ct => fake.AddOrderAsync(2, ct));

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, token, hooks);

                exit.ShouldBe(1);
                error.ToString().TrimEnd().ShouldBe("Failed: the restore changed during the run.");
                Directory.Exists(Path.Combine(localRoot, "legacy-fit-check")).ShouldBeFalse();
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    private static string NewLocalRoot() => Path.Combine(Path.GetTempPath(), $"csps-fitcheck-{Guid.NewGuid():N}", "_local");

    private static FakeTimeProvider NewTime() => new(new DateTimeOffset(2026, 10, 29, 0, 0, 0, TimeSpan.Zero));

    private static void DeleteRoot(string localRoot)
    {
        var root = Path.GetDirectoryName(localRoot);
        if (root is not null && Directory.Exists(root))
        {
            Directory.Delete(root, recursive: true);
        }
    }
}

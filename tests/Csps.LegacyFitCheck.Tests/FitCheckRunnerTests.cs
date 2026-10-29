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
                text.ShouldContain("imported", Case.Insensitive);

                trialName.ShouldNotBeNull();
                (await TrialDatabase.ExistsAsync(server.MasterConnectionString, trialName, token)).ShouldBeFalse();
                (await fake.CountAsync(token)).ShouldBe((1, 2));
            }
            finally
            {
                var root = Path.GetDirectoryName(localRoot);
                if (root is not null && Directory.Exists(root))
                {
                    Directory.Delete(root, recursive: true);
                }
            }
        }
    }
}

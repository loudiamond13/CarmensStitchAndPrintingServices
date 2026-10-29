using System.Text.RegularExpressions;
using Csps.LegacyFitCheck.Tests.Fakes;
using Csps.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.LegacyFitCheck.Tests;

public sealed class ColumnInventoryTests
{
    [Fact]
    public async Task AFakeRunListsNoUnknownColumns()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var text = await RunAndReadFindingsAsync(fake, token);

            Regex.IsMatch(text, @"Column inventory: 43 columns read, 0 unknown, 0 missing").ShouldBeTrue(text);
            text.ShouldNotContain("column.unknown");
            text.ShouldNotContain("column.missing");
            Line(text, "Orders.CreatedBy").ShouldContain("NotChecked");
            Line(text, "Orders.CreatedBy").ShouldContain("creator attribution, Phase 15");
            Line(text, "Payments.UpdatedBy").ShouldContain("NotChecked");
            Line(text, "Payments.UpdatedBy").ShouldContain("creator attribution, Phase 15");
        }
    }

    [Fact]
    public async Task AnUnknownColumnIsCannotMap()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token, new ShadowColumn("Orders", "MysteryColumn"));
        await using (fake.ConfigureAwait(true))
        {
            var text = await RunAndReadFindingsAsync(fake, token);

            var unknown = text.Split('\n').Where(static line => line.Contains("column.unknown", StringComparison.Ordinal)).ShouldHaveSingleItem();
            unknown.ShouldContain("CannotMap");
            unknown.ShouldContain("Orders.MysteryColumn");
            text.ShouldContain("1 unknown, 0 missing");
        }
    }

    private static string Line(string text, string path) =>
        text.Split('\n').Where(line => line.Contains(path, StringComparison.Ordinal)).ShouldHaveSingleItem();

    private static async Task<string> RunAndReadFindingsAsync(FakeLegacyDatabase fake, CancellationToken token)
    {
        var server = await SqlServerInstance.GetSharedAsync();
        var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
        var localRoot = Path.Combine(Path.GetTempPath(), $"csps-fitcheck-{Guid.NewGuid():N}", "_local");
        var time = new FakeTimeProvider(new DateTimeOffset(2026, 10, 29, 0, 0, 0, TimeSpan.Zero));
        using var output = new StringWriter();
        using var error = new StringWriter();
        try
        {
            var exit = await FitCheckRunner.RunAsync(targets, localRoot, time, output, error, token);

            exit.ShouldBe(0, error.ToString());
            var file = Directory.EnumerateFiles(Path.Combine(localRoot, "legacy-fit-check"), "findings-*.md").ShouldHaveSingleItem();
            return await File.ReadAllTextAsync(file, token);
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

using System.Diagnostics;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-01, CWE-204, D-39: with the real 500 ms floor, an unknown email, a wrong password, a deactivated account and a
/// success take the same time, so the answer's speed does not say which one it was.
/// </summary>
public sealed class SignInTimingTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int Rounds = 8;
    private static readonly TimeSpan Floor = TimeSpan.FromMilliseconds(500);

    [Fact]
    public async Task EveryBranchTakesAtLeastTheFloorAndTheMediansAgree()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var success = await AuthClient.CreateStaffAsync(factory);
        var deactivated = await AuthClient.CreateStaffAsync(factory, StaffState.Deactivated);

        // A fresh account per round, so five wrong passwords never lock one and change its branch.
        var wrongAccounts = new List<TestStaff>();
        for (var round = 0; round < Rounds; round++)
        {
            wrongAccounts.Add(await AuthClient.CreateStaffAsync(factory));
        }

        // The first request pays for host start-up, JIT and the first connection; it is not measured.
        (await AuthClient.SignInAsync(client, AuthClient.NewEmail(), "warm-up")).Dispose();

        var samples = new Dictionary<string, List<double>>(StringComparer.Ordinal)
        {
            ["unknown"] = [],
            ["wrong"] = [],
            ["deactivated"] = [],
            ["success"] = [],
        };
        for (var round = 0; round < Rounds; round++)
        {
            samples["unknown"].Add(await TimeAsync(client, AuthClient.NewEmail(), "some-password"));
            samples["wrong"].Add(await TimeAsync(client, wrongAccounts[round].Email, "not-the-password"));
            samples["deactivated"].Add(await TimeAsync(client, deactivated.Email, deactivated.Password));
            samples["success"].Add(await TimeAsync(client, success.Email, success.Password));
        }

        var all = samples.Values.SelectMany(static list => list).ToList();
        var overall = Median(all);
        var report = string.Join(
            "; ",
            samples.Select(pair => FormattableString.Invariant($"{pair.Key} median {Median(pair.Value):F0} ms")));
        var summary = FormattableString.Invariant($"{report}; overall median {overall:F0} ms; min {all.Min():F0} ms; max {all.Max():F0} ms");
        TestContext.Current.SendDiagnosticMessage(summary);
        await File.WriteAllTextAsync(
            Path.Combine(AppContext.BaseDirectory, "sign-in-timing.txt"), summary, TestContext.Current.CancellationToken);

        all.Min().ShouldBeGreaterThanOrEqualTo(Floor.TotalMilliseconds, "every branch waits for the floor");
        foreach (var (branch, values) in samples)
        {
            Math.Abs(Median(values) - overall).ShouldBeLessThanOrEqualTo(overall * 0.2, $"{branch} median strays from the overall median: {summary}");
        }
    }

    private static async Task<double> TimeAsync(HttpClient client, string email, string password)
    {
        var watch = Stopwatch.StartNew();
        using var response = await AuthClient.SignInAsync(client, email, password);
        watch.Stop();
        return watch.Elapsed.TotalMilliseconds;
    }

    private static double Median(List<double> values)
    {
        var sorted = values.Order().ToList();
        var middle = sorted.Count / 2;
        return sorted.Count % 2 == 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    }
}

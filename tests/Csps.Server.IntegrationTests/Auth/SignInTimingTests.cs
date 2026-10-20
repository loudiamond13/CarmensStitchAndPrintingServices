using System.Diagnostics;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-01, CWE-204, D-39: with the real 500 ms floor, an unknown email, a wrong password, a deactivated account and a
/// success take the same time, so the answer's speed does not say which one it was. It runs alone
/// (<see cref="SignInTimingRunsAlone"/>) because, under a full parallel run, the success branch's extra writes can take
/// its own work past the floor. That is accepted (05 D-57): a success already answers differently from every failure, so only
/// the failure branches must be indistinguishable.
/// </summary>
[Collection(SignInTimingRunsAlone.Name)]
public sealed class SignInTimingTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int Rounds = 8;
    private static readonly TimeSpan Floor = TimeSpan.FromMilliseconds(500);

    // Fixed branch order, so each per-round time is labeled with the branch it came from.
    private static readonly string[] Branches = ["unknown", "wrong", "deactivated", "success"];

    [Fact]
    public async Task EveryBranchTakesAtLeastTheFloorAndTheMediansAgree()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var success = await AuthClient.CreateStaffAsync(factory);
        var deactivated = await AuthClient.CreateStaffAsync(factory, StaffState.Deactivated);
        var warmWrong = await AuthClient.CreateStaffAsync(factory);

        // A fresh account per round, so five wrong passwords never lock one and change its branch.
        var wrongAccounts = new List<TestStaff>();
        for (var round = 0; round < Rounds; round++)
        {
            wrongAccounts.Add(await AuthClient.CreateStaffAsync(factory));
        }

        // The first call of each branch pays one-time costs (host start-up, JIT, the first connection, and for success the
        // first challenge, code email and Data Protection key ring), so none of them land in a sample.
        (await AuthClient.SignInAsync(client, AuthClient.NewEmail(), "warm-up")).Dispose();
        (await AuthClient.SignInAsync(client, warmWrong.Email, "not-the-password")).Dispose();
        (await AuthClient.SignInAsync(client, deactivated.Email, deactivated.Password)).Dispose();
        (await AuthClient.SignInAsync(client, success.Email, success.Password)).Dispose();

        var samples = Branches.ToDictionary(static branch => branch, static _ => new List<double>(), StringComparer.Ordinal);
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
            Branches.Select(branch => FormattableString.Invariant($"{branch} median {Median(samples[branch]):F0} ms")));
        var perRound = string.Join(
            " | ",
            Enumerable.Range(0, Rounds).Select(round => string.Join(
                ", ", Branches.Select(branch => FormattableString.Invariant($"{samples[branch][round]:F0}")))));
        var summary = FormattableString.Invariant($"{report}; overall median {overall:F0} ms; min {all.Min():F0} ms; max {all.Max():F0} ms; rounds ({string.Join(", ", Branches)}): {perRound}");
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

/// <summary>The timing test runs after every parallel collection, with nothing else in the assembly running beside it.</summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class SignInTimingRunsAlone
{
    public const string Name = "Sign-in timing, run alone";
}

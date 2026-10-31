using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Profile;

/// <summary>SEC-07, T-05-22: two tabs saving the same profile with the same version never both succeed.</summary>
public sealed class ProfileConcurrencyTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/profile";
    private const string StaleDetail = "This was changed by someone else. Reload and try again.";
    private const int Repetitions = 20;

    [Fact]
    public async Task TwoSavesWithTheSameVersionGiveExactlyOneWinnerEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);

        for (var round = 1; round <= Repetitions; round++)
        {
            var version = (await ReadAsync(await GetAsync(client, session.AccessToken))).GetProperty("version").GetString();
            var tabOne = ("Ana" + round, "Cruz");
            var tabTwo = ("Bea" + round, "Dela");

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => PutAsync(client, session.AccessToken, tabOne, version),
                () => PutAsync(client, session.AccessToken, tabTwo, version));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");

            var (winner, loser, winnerNames) = firstResponse.StatusCode == HttpStatusCode.OK ? (firstResponse, secondResponse, tabOne) : (secondResponse, firstResponse, tabTwo);
            var refusal = await ReadAsync(loser);
            refusal.GetProperty("code").GetString().ShouldBe("edit.stale", $"round {round}");
            refusal.GetProperty("detail").GetString().ShouldBe(StaleDetail, $"round {round}");

            var stored = await ReadAsync(await GetAsync(client, session.AccessToken));
            stored.GetProperty("firstName").GetString().ShouldBe(winnerNames.Item1, $"round {round}");
            stored.GetProperty("lastName").GetString().ShouldBe(winnerNames.Item2, $"round {round}");
            stored.GetProperty("version").GetGuid().ShouldBe((await ReadAsync(winner)).GetProperty("version").GetGuid(), $"round {round}");
        }
    }

    private static async Task<HttpResponseMessage> GetAsync(HttpClient client, string accessToken)
    {
        using var request = ApiRequests.Get(Route, accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> PutAsync(HttpClient client, string accessToken, (string First, string Last) names, string? version)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, Route, accessToken);
        request.Content = JsonContent.Create(new { firstName = names.First, lastName = names.Last, version });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using (response)
        {
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            return document.RootElement.Clone();
        }
    }
}

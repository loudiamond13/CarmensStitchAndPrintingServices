using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>
/// SEC-07, SEC-08, T-05-65, success criterion 6: two Managers saving the same person with the same version never both win. The
/// stored name and the last changer are the winner's.
/// </summary>
public sealed class UserEditConcurrencyTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string StaleDetail = "This was changed by someone else. Reload and try again.";
    private const int Repetitions = 20;

    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Manager)]
    public async Task TwoManagersSavingTheSamePersonWithTheSameVersionGiveExactlyOneWinnerEveryTime(string role)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ned", "Reyes", role);

        for (var round = 1; round <= Repetitions; round++)
        {
            var version = (await UserFixtures.ReadDetailAsync(client, m1.AccessToken, person.Id)).GetProperty("version").GetString();
            var byM1 = ("Ana" + round, "Cruz");
            var byM2 = ("Bea" + round, "Dela");

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => PutAsync(client, m1.AccessToken, person.Id, byM1, role, version),
                () => PutAsync(client, m2.AccessToken, person.Id, byM2, role, version));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.OK).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.Conflict).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");

            var (winner, loser, winnerNames, winnerId) = firstResponse.StatusCode == HttpStatusCode.OK
                ? (firstResponse, secondResponse, byM1, m1.UserId)
                : (secondResponse, firstResponse, byM2, m2.UserId);
            var refusal = await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken);
            refusal.GetProperty("code").GetString().ShouldBe("edit.stale", $"round {round}");
            refusal.GetProperty("detail").GetString().ShouldBe(StaleDetail, $"round {round}");

            var won = await ReadAsync(winner);
            var stored = await UserFixtures.ReadDetailAsync(client, m1.AccessToken, person.Id);
            stored.GetProperty("firstName").GetString().ShouldBe(winnerNames.Item1, $"round {round}");
            stored.GetProperty("lastName").GetString().ShouldBe(winnerNames.Item2, $"round {round}");
            stored.GetProperty("version").GetGuid().ShouldBe(won.GetProperty("version").GetGuid(), $"round {round}");
            stored.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(winnerId, $"round {round}");
        }
    }

    private static async Task<HttpResponseMessage> PutAsync(HttpClient client, string accessToken, Guid id, (string First, string Last) names, string role, string? version)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, $"{UserFixtures.Route}/{id:D}", accessToken);
        request.Content = JsonContent.Create(new { firstName = names.First, lastName = names.Last, role, version });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.Clone();
    }
}

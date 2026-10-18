using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Profile;

/// <summary>SEC-08, CWE-915: who last changed an account and when come from the token and the server clock, never from the request body.</summary>
public sealed class ProfileAttributionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/profile";

    [Fact]
    public async Task ASavedNameRecordsTheCallerAndTheServerClockWhateverTheBodyClaims()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var session = await TestSessions.StartAsync(baseFactory);
        var before = await ReadRowAsync(session.UserId);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var forged = Guid.NewGuid();

        using var save = await SaveAsync(client, session.AccessToken, "Ana", "Cruz", await ReadVersionAsync(client, session.AccessToken), new
        {
            createdById = forged,
            createdAtUtc = "2001-01-01T00:00:00+00:00",
            updatedById = forged,
            updatedAtUtc = "2002-02-02T00:00:00+00:00",
        });

        save.StatusCode.ShouldBe(HttpStatusCode.OK);
        var after = await ReadRowAsync(session.UserId);
        after.UpdatedById.ShouldBe(session.UserId);
        after.UpdatedAtUtc.ShouldBe(clock.GetUtcNow());
        after.UpdatedAtUtc!.Value.Offset.ShouldBe(TimeSpan.Zero);
        after.CreatedById.ShouldBeNull();
        after.CreatedAtUtc.ShouldBe(before.CreatedAtUtc);
    }

    [Fact]
    public async Task AWrongPasswordOnTheSameAccountChangesNeitherUpdatedColumn()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var session = await TestSessions.StartAsync(baseFactory);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        using var save = await SaveAsync(client, session.AccessToken, "Ana", "Cruz", await ReadVersionAsync(client, session.AccessToken));
        save.StatusCode.ShouldBe(HttpStatusCode.OK);
        var edited = await ReadRowAsync(session.UserId);
        clock.Advance(TimeSpan.FromMinutes(5));

        using var wrong = await AuthClient.SignInAsync(client, edited.Email, "Not-the-password-1!");

        wrong.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var after = await ReadRowAsync(session.UserId);
        after.AccessFailedCount.ShouldBe(edited.AccessFailedCount + 1);
        after.UpdatedById.ShouldBe(edited.UpdatedById);
        after.UpdatedAtUtc.ShouldBe(edited.UpdatedAtUtc);
    }

    [Fact]
    public async Task AFirstEditSetsUpdatedAndASecondEditMovesItForward()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var session = await TestSessions.StartAsync(baseFactory);
        var untouched = await ReadRowAsync(session.UserId);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);

        using var first = await SaveAsync(client, session.AccessToken, "Ana", "Cruz", await ReadVersionAsync(client, session.AccessToken));
        var afterFirst = await ReadRowAsync(session.UserId);
        clock.Advance(TimeSpan.FromMinutes(10));
        using var second = await SaveAsync(client, session.AccessToken, "Bea", "Dela", await ReadVersionAsync(client, session.AccessToken));
        var afterSecond = await ReadRowAsync(session.UserId);

        untouched.UpdatedById.ShouldBeNull();
        untouched.UpdatedAtUtc.ShouldBeNull();
        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        afterFirst.UpdatedAtUtc.ShouldBe(clock.Start);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        afterSecond.UpdatedById.ShouldBe(session.UserId);
        afterSecond.UpdatedAtUtc.ShouldBe(clock.Start + TimeSpan.FromMinutes(10));
    }

    private static async Task<HttpResponseMessage> SaveAsync(HttpClient client, string accessToken, string firstName, string lastName, Guid version, object? extra = null)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, Route, accessToken);
        var body = new Dictionary<string, object?> { ["firstName"] = firstName, ["lastName"] = lastName, ["version"] = version };
        if (extra is not null)
        {
            foreach (var property in extra.GetType().GetProperties())
            {
                body[property.Name] = property.GetValue(extra);
            }
        }

        request.Content = JsonContent.Create(body);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<Guid> ReadVersionAsync(HttpClient client, string accessToken)
    {
        using var request = ApiRequests.Get(Route, accessToken);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.GetProperty("version").GetGuid();
    }

    private async Task<Row> ReadRowAsync(Guid id)
    {
        await using var context = database.CreateContext();
        return await context.Users.AsNoTracking()
            .Where(user => user.Id == id)
            .Select(user => new Row(user.Email!, user.CreatedById, user.CreatedAtUtc, user.UpdatedById, user.UpdatedAtUtc, user.AccessFailedCount))
            .SingleAsync(TestContext.Current.CancellationToken);
    }

    private sealed record Row(string Email, Guid? CreatedById, DateTimeOffset CreatedAtUtc, Guid? UpdatedById, DateTimeOffset? UpdatedAtUtc, int AccessFailedCount);
}

using System.Net;
using Csps.Application.Email;
using Csps.Domain.QuoteRequests;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>INQ-04, D-09, Edge INQ-01 concurrency: at most 20 alert emails and one overflow email an hour, and every request is still saved.</summary>
public sealed class QuoteAlertCapTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Alerts = "quotes@example.com";

    // 10:05 UTC is 6:05 PM in the business zone, so the business hour started at 10:00 UTC.
    private static readonly DateTimeOffset Start = new(2026, 11, 22, 10, 5, 0, TimeSpan.Zero);

    [Fact]
    public async Task TheTwentyFirstBecomesOneOverflow()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(Alerts);
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var clock = new FakeTimeProvider(Start);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = factory.CreateClient();

        for (var count = 1; count <= 22; count++)
        {
            await PostOkAsync(client);
            clock.Advance(TimeSpan.FromSeconds(1));
        }

        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(22, "every request is saved");
        (await CountAsync(context, AuthEmailKind.QuoteAlert)).ShouldBe(20);
        (await CountAsync(context, AuthEmailKind.QuoteAlertsOverflow)).ShouldBe(1, "one overflow email for the hour, none for the 22nd");
        (await context.EmailOutbox.AsNoTracking().Where(row => row.Kind == AuthEmailKind.QuoteAlertsOverflow).SingleAsync(TestContext.Current.CancellationToken))
            .ToAddress.ShouldBe(Alerts);
    }

    [Fact]
    public async Task ANewHourStartsAgain()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(Alerts);
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var limited = baseFactory.WithWebHostBuilder(builder => builder.UseSetting("QuoteRequests:AlertsPerHour", "2"));
        var clock = new FakeTimeProvider(Start);
        await using var factory = AuthClient.WithClock(limited, clock);
        using var client = factory.CreateClient();
        for (var count = 1; count <= 3; count++)
        {
            await PostOkAsync(client);
        }

        // 10:59:59 is still the same business hour; 11:00:00 starts the next one.
        clock.Advance(TimeSpan.FromMinutes(54) + TimeSpan.FromSeconds(59));
        await PostOkAsync(client);
        await using (var sameHour = database.CreateContext())
        {
            (await CountAsync(sameHour, AuthEmailKind.QuoteAlert)).ShouldBe(2, "the fourth request is inside the same hour");
            (await CountAsync(sameHour, AuthEmailKind.QuoteAlertsOverflow)).ShouldBe(1);
        }

        clock.Advance(TimeSpan.FromSeconds(1));
        await PostOkAsync(client);
        await PostOkAsync(client);
        await PostOkAsync(client);

        await using var context = database.CreateContext();
        (await CountAsync(context, AuthEmailKind.QuoteAlert)).ShouldBe(4, "two more alerts in the new hour");
        (await CountAsync(context, AuthEmailKind.QuoteAlertsOverflow)).ShouldBe(2, "one overflow email per hour");
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(7);
    }

    [Fact]
    public async Task ParallelSendsNeverPassTwenty()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(Alerts);
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var clock = new FakeTimeProvider(Start);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = factory.CreateClient();
        for (var count = 1; count <= 19; count++)
        {
            await PostOkAsync(client);
        }

        // Every ticket is fetched first, so the gate holds back only the posts and they reach the server together.
        var bodies = await Task.WhenAll(Enumerable.Range(0, 5).Select(async _ =>
        {
            var body = QuoteRequestFixtures.MinimalBody();
            body["ticket"] = await QuoteRequestFixtures.GetTicketAsync(client);
            return body;
        }));
        var responses = await ConcurrentRequests.SendAllTogetherAsync(
            [.. bodies.Select(body => (Func<Task<HttpResponseMessage>>)(() => QuoteRequestFixtures.PostAsync(client, body)))]);

        var statuses = responses.Select(static response => response.StatusCode).ToList();
        foreach (var response in responses)
        {
            response.Dispose();
        }

        statuses.ShouldAllBe(status => status == HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(24);
        (await CountAsync(context, AuthEmailKind.QuoteAlert)).ShouldBe(20, "never more than 20 in an hour");
        (await CountAsync(context, AuthEmailKind.QuoteAlertsOverflow)).ShouldBe(1, "one overflow email, not one per racing request");
    }

    [Fact]
    public async Task TheHourlyLimitIsASetting()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(Alerts);
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var limited = baseFactory.WithWebHostBuilder(builder => builder.UseSetting("QuoteRequests:AlertsPerHour", "2"));
        var clock = new FakeTimeProvider(Start);
        await using var factory = AuthClient.WithClock(limited, clock);
        using var client = factory.CreateClient();

        for (var count = 1; count <= 4; count++)
        {
            await PostOkAsync(client);
        }

        await using var context = database.CreateContext();
        (await CountAsync(context, AuthEmailKind.QuoteAlert)).ShouldBe(2);
        (await CountAsync(context, AuthEmailKind.QuoteAlertsOverflow)).ShouldBe(1);
    }

    private static async Task PostOkAsync(HttpClient client)
    {
        using var response = await QuoteRequestFixtures.PostAsync(client, QuoteRequestFixtures.MinimalBody());
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    private static Task<int> CountAsync(Csps.Infrastructure.Persistence.CspsDbContext context, AuthEmailKind kind) =>
        context.EmailOutbox.CountAsync(row => row.Kind == kind, TestContext.Current.CancellationToken);

    private async Task SetAlertsAddressAsync(string address)
    {
        await using var context = database.CreateContext();
        await context.SiteSettings.ExecuteUpdateAsync(set => set.SetProperty(row => row.QuoteAlertsEmail, address), TestContext.Current.CancellationToken);
    }
}

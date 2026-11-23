using System.Net;
using Csps.Domain.QuoteRequests;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>
/// INQ-01, INQ-03, D-37: the same mobile number or the same email can send 3 quote requests a day. A bot that rotates its address is
/// stopped, requests of one sender stay separate rows until the limit, and the count and the insert run under one lock.
/// </summary>
public sealed class QuoteSenderLimitTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string RateLimitedDetail = "Too many attempts from this address. Please wait and try again.";
    private static readonly DateTimeOffset Start = new(2026, 11, 22, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task TheFourthRequestFromOnePhoneInADayIs429AndTheDayWindowSlides()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var clock = new FakeTimeProvider(Start);
        await using var factory = Host(baseFactory, clock);
        using var client = factory.CreateClient();

        foreach (var phone in new[] { "0917 123 4567", "09171234567", "0917-123-4567" })
        {
            using var saved = await PostAsync(client, "Juan Dela Cruz", phone, null);
            saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            clock.Advance(TimeSpan.FromHours(1));
        }

        using var refused = await PostAsync(client, "Juan Dela Cruz", "+63 917 123 4567", null);

        refused.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("rate-limited");
        problem.GetProperty("detail").GetString().ShouldBe(RateLimitedDetail);
        var wait = refused.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds;
        wait.ShouldBe(21 * 3600, "the first request leaves the window 21 hours from now");
        (await RowCountAsync()).ShouldBe(3, "the refused request saved nothing and each earlier one is its own row");

        clock.Advance(TimeSpan.FromHours(21) - TimeSpan.FromTicks(1));
        using var oneTickShort = await PostAsync(client, "Juan Dela Cruz", "0917 123 4567", null);
        clock.Advance(TimeSpan.FromTicks(1));
        using var exactDay = await PostAsync(client, "Juan Dela Cruz", "0917 123 4567", null);

        oneTickShort.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests, "one tick before 24 hours the first request still counts");
        exactDay.StatusCode.ShouldBe(HttpStatusCode.OK, "24 hours after the first, a new one is saved");
        (await RowCountAsync()).ShouldBe(4);
    }

    [Fact]
    public async Task TheSameEmailCountsAcrossPhonesAndIgnoresCase()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = Host(baseFactory, new FakeTimeProvider(Start));
        using var client = factory.CreateClient();

        foreach (var phone in new[] { "0917 000 0001", "0917 000 0002", "0917 000 0003" })
        {
            using var saved = await PostAsync(client, "Maria Santos", phone, "a@example.com");
            saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using var refused = await PostAsync(client, "Maria Santos", "0917 000 0004", "A@Example.com");
        using var otherSender = await PostAsync(client, "Pedro Reyes", "0917 000 0005", "pedro@example.com");

        refused.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        otherSender.StatusCode.ShouldBe(HttpStatusCode.OK, "a different phone and email is not affected");
        (await RowCountAsync()).ShouldBe(4);
    }

    [Fact]
    public async Task ARequestWithNoEmailNeverMatchesOtherRequestsWithNoEmail()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = Host(baseFactory, new FakeTimeProvider(Start));
        using var client = factory.CreateClient();

        for (var number = 1; number <= 5; number++)
        {
            using var saved = await PostAsync(client, "Visitor", $"0917 111 000{number}", null);
            saved.StatusCode.ShouldBe(HttpStatusCode.OK, $"request {number} has its own phone and no email");
        }

        (await RowCountAsync()).ShouldBe(5);
    }

    [Fact]
    public async Task ParallelSendsFromOnePhoneNeverMakeAFourthRow()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = Host(baseFactory, new FakeTimeProvider(Start));
        using var client = factory.CreateClient();
        foreach (var number in new[] { 1, 2 })
        {
            using var saved = await PostAsync(client, $"Juan {number}", "0917 123 4567", null);
            saved.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var both = await Task.WhenAll(
            PostAsync(client, "Juan 3", "0917 123 4567", null),
            PostAsync(client, "Juan 4", "0917 123 4567", null));

        try
        {
            both.Select(static response => response.StatusCode).Order().ShouldBe([HttpStatusCode.OK, HttpStatusCode.TooManyRequests]);
            (await RowCountAsync()).ShouldBe(3);
        }
        finally
        {
            foreach (var response in both)
            {
                response.Dispose();
            }
        }
    }

    [Fact]
    public async Task ACaughtBotIsNotCountedAndAReplayIsNotCountedAgain()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = Host(baseFactory, new FakeTimeProvider(Start));
        using var client = factory.CreateClient();
        for (var attempt = 0; attempt < 4; attempt++)
        {
            var bot = QuoteRequestFixtures.MinimalBody();
            bot["subjectLine"] = "bot text";
            using var caught = await QuoteRequestFixtures.PostAsync(client, bot);
            caught.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var key = Guid.NewGuid();
        var body = QuoteRequestFixtures.MinimalBody();
        using var first = await QuoteRequestFixtures.PostAsync(client, body, key);
        using var second = await PostAsync(client, "Juan Dela Cruz", "0917 123 4567", null);
        using var replay = await QuoteRequestFixtures.PostAsync(client, body, key);
        using var third = await PostAsync(client, "Juan Dela Cruz", "0917 123 4567", null);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        replay.StatusCode.ShouldBe(HttpStatusCode.OK);
        replay.Headers.GetValues("Idempotent-Replayed").ShouldBe(["true"]);
        third.StatusCode.ShouldBe(HttpStatusCode.OK, "the four caught bots and the replay did not count");
        (await RowCountAsync()).ShouldBe(3);
    }

    private static WebApplicationFactory<Program> Host(WebApplicationFactory<Program> baseFactory, FakeTimeProvider clock) =>
        AuthClient.WithClock(baseFactory, clock).WithWebHostBuilder(builder => builder.UseSetting("QuoteRequests:PerSenderPerDay", "3"));

    private static Task<HttpResponseMessage> PostAsync(HttpClient client, string name, string phone, string? email)
    {
        var body = new Dictionary<string, object?> { ["customerName"] = name, ["contactNumber"] = phone, ["email"] = email };
        return QuoteRequestFixtures.PostAsync(client, body);
    }

    private async Task<int> RowCountAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken);
    }
}

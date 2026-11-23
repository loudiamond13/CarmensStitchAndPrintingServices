using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Application.Images;
using Csps.Domain.QuoteRequests;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.RateLimiting;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>INQ-03, D-25, Pitfall 4: the form ticket, the honeypot and the minimum time keep bots out without a puzzle, and a real lead is never silently dropped.</summary>
public sealed class QuoteBotGuardTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string ExpiredCode = "quote-requests.ticket-expired";
    private static readonly DateTimeOffset Start = new(2026, 11, 22, 10, 0, 0, TimeSpan.Zero);
    private static readonly Dictionary<string, string> ThreeSeconds = new() { ["QuoteRequests:MinimumSeconds"] = "3" };

    [Fact]
    public async Task ARealVisitorWithAFreshTicketIsSaved()
    {
        await database.ResetAsync();
        await using var baseFactory = new RealLimitsFactory(database.ConnectionString, ThreeSeconds);
        var clock = new FakeTimeProvider(Start);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["ticket"] = await QuoteRequestFixtures.GetTicketAsync(client);
        clock.Advance(TimeSpan.FromSeconds(3));

        using var response = await QuoteRequestFixtures.PostAsync(client, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        CatchEvents(baseFactory).ShouldBeEmpty();
    }

    [Fact]
    public async Task AFilledHoneypotLooksLikeSuccess()
    {
        await database.ResetAsync();
        await using var baseFactory = new RealLimitsFactory(database.ConnectionString, ThreeSeconds);
        var clock = new FakeTimeProvider(Start);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = factory.CreateClient();
        var real = QuoteRequestFixtures.MinimalBody();
        real["photos"] = new[] { "logo.png" };
        real["uploadKey"] = QuoteRequestFixtures.NewUploadKey();
        real["ticket"] = await QuoteRequestFixtures.GetTicketAsync(client);
        var bot = QuoteRequestFixtures.MinimalBody();
        bot["photos"] = new[] { "logo.png" };
        bot["uploadKey"] = QuoteRequestFixtures.NewUploadKey();
        bot["subjectLine"] = "hello-bot-text";
        bot["ticket"] = await QuoteRequestFixtures.GetTicketAsync(client);
        clock.Advance(TimeSpan.FromSeconds(10));

        using var caught = await QuoteRequestFixtures.PostAsync(client, bot);
        using var saved = await QuoteRequestFixtures.PostAsync(client, real);

        caught.StatusCode.ShouldBe(HttpStatusCode.OK, await caught.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        saved.StatusCode.ShouldBe(HttpStatusCode.OK);
        var caughtShape = await ShapeAsync(caught);
        var savedShape = await ShapeAsync(saved);
        caughtShape.ShouldBe(savedShape, "a caught bot sees the same answer shape as a real visitor");
        await using var context = database.CreateContext();
        var row = await context.Set<QuoteRequest>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        row.Id.ShouldNotBe(await IdAsync(caught), "the caught bot's id is made up and nothing was saved under it");
        ShouldHaveOneCatch(baseFactory, "honeypot");
    }

    [Fact]
    public async Task ATooFastSendLooksLikeSuccessAndExactlyTheMinimumIsSaved()
    {
        await database.ResetAsync();
        await using var baseFactory = new RealLimitsFactory(database.ConnectionString, ThreeSeconds);
        var clock = new FakeTimeProvider(Start);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = factory.CreateClient();
        var tooFast = QuoteRequestFixtures.MinimalBody();
        tooFast["ticket"] = await QuoteRequestFixtures.GetTicketAsync(client);
        clock.Advance(TimeSpan.FromSeconds(3) - TimeSpan.FromMilliseconds(1));

        using var early = await QuoteRequestFixtures.PostAsync(client, tooFast);

        early.StatusCode.ShouldBe(HttpStatusCode.OK, await early.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using (var none = database.CreateContext())
        {
            (await none.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0, "2.999 seconds is one tick too young");
        }

        ShouldHaveOneCatch(baseFactory, "too-fast");
        var onTime = QuoteRequestFixtures.MinimalBody();
        onTime["ticket"] = await QuoteRequestFixtures.GetTicketAsync(client);
        clock.Advance(TimeSpan.FromSeconds(3));

        using var exact = await QuoteRequestFixtures.PostAsync(client, onTime);

        exact.StatusCode.ShouldBe(HttpStatusCode.OK, await exact.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1, "exactly 3 seconds is accepted");
    }

    [Fact]
    public async Task AnExpiredOrTamperedTicketIsA400AndNothingIsSaved()
    {
        await database.ResetAsync();
        await using var baseFactory = new RealLimitsFactory(database.ConnectionString, ThreeSeconds);
        var clock = new FakeTimeProvider(Start);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = factory.CreateClient();
        var old = await QuoteRequestFixtures.GetTicketAsync(client);
        var fresh = await QuoteRequestFixtures.GetTicketAsync(client);
        var tampered = fresh[..^1] + (fresh[^1] == 'A' ? 'B' : 'A');
        clock.Advance(TimeSpan.FromHours(24) + TimeSpan.FromSeconds(1));

        foreach (var (name, ticket) in new[] { ("a ticket past 24 hours", old), ("a ticket with one character changed", tampered), ("a ticket of nonsense", "not-a-ticket") })
        {
            var body = QuoteRequestFixtures.MinimalBody();
            body["ticket"] = ticket;
            using var response = await QuoteRequestFixtures.PostAsync(client, body);

            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, name);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe(ExpiredCode, name);
        }

        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        CatchEvents(baseFactory).ShouldBeEmpty("an expired ticket is not a caught bot");
    }

    [Fact]
    public async Task AnExpiredTicketAnswerCarriesAReplacementThatTheImmediateResendCanUse()
    {
        await database.ResetAsync();
        await using var baseFactory = new RealLimitsFactory(database.ConnectionString, ThreeSeconds);
        var clock = new FakeTimeProvider(Start);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["ticket"] = await QuoteRequestFixtures.GetTicketAsync(client);
        clock.Advance(TimeSpan.FromHours(24) + TimeSpan.FromSeconds(1));

        using var expired = await QuoteRequestFixtures.PostAsync(client, body);

        expired.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(expired, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe(ExpiredCode);
        var replacement = problem.GetProperty("replacementTicket").GetString().ShouldNotBeNull();
        body["ticket"] = replacement;

        using var resend = await QuoteRequestFixtures.PostAsync(client, body);

        resend.StatusCode.ShouldBe(HttpStatusCode.OK, await resend.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1, "the resend is saved, not treated as too fast");
        CatchEvents(baseFactory).ShouldBeEmpty();
    }

    [Fact]
    public async Task ATamperedTicketAnswerAlsoCarriesAUsableReplacementButAFreshTicketIsStillTooFast()
    {
        await database.ResetAsync();
        await using var baseFactory = new RealLimitsFactory(database.ConnectionString, ThreeSeconds);
        var clock = new FakeTimeProvider(Start);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["ticket"] = "not-a-ticket";

        using var refused = await QuoteRequestFixtures.PostAsync(client, body);

        var problem = await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken);
        body["ticket"] = problem.GetProperty("replacementTicket").GetString();
        using var resend = await QuoteRequestFixtures.PostAsync(client, body);
        resend.StatusCode.ShouldBe(HttpStatusCode.OK);

        var fresh = QuoteRequestFixtures.MinimalBody();
        fresh["ticket"] = await QuoteRequestFixtures.GetTicketAsync(client);
        using var tooFast = await QuoteRequestFixtures.PostAsync(client, fresh);

        tooFast.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1, "only the replacement send was saved");
        ShouldHaveOneCatch(baseFactory, "too-fast");
    }

    [Fact]
    public async Task NoTicketIsTheSame400()
    {
        await database.ResetAsync();
        await using var factory = new RealLimitsFactory(database.ConnectionString, ThreeSeconds);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["ticket"] = null;

        using var response = await QuoteRequestFixtures.PostAsync(client, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe(ExpiredCode);
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TheTicketAnswerCarriesThePhotoRulesAndIsNeverCached()
    {
        await using var factory = new RealLimitsFactory(database.ConnectionString, ThreeSeconds);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri($"{QuoteRequestFixtures.Route}/ticket", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("ticket").GetString().ShouldNotBeNullOrWhiteSpace();
        var rules = document.RootElement.GetProperty("photoRules");
        rules.GetProperty("maxPhotos").GetInt32().ShouldBe(QuoteRequestRules.MaxPhotos);
        rules.GetProperty("maxBytes").GetInt32().ShouldBe(ImageUploadLimits.MaxFileBytes);
        rules.GetProperty("maxPixels").GetInt64().ShouldBe(25_000_000);
    }

    [Fact]
    public async Task TheGuardsNeverAskTheVisitorToSolveAnything()
    {
        await using var factory = new RealLimitsFactory(database.ConnectionString, ThreeSeconds);
        using var client = factory.CreateClient();

        var text = await client.GetStringAsync(new Uri($"{QuoteRequestFixtures.Route}/ticket", UriKind.Relative), TestContext.Current.CancellationToken);

        foreach (var word in new[] { "captcha", "puzzle", "challenge", "recaptcha", "turnstile" })
        {
            text.ShouldNotContain(word, Case.Insensitive);
        }
    }

    private static List<Serilog.Events.LogEvent> CatchEvents(CspsApiFactory factory) =>
        [.. factory.Sink.Events.Where(static logEvent => logEvent.MessageTemplate.Text.Contains("bot guard", StringComparison.OrdinalIgnoreCase))];

    // One line, a reason code only: no name, number, message or honeypot text reaches any log line (CWE-532, D-25).
    private static void ShouldHaveOneCatch(CspsApiFactory factory, string reason)
    {
        var caught = CatchEvents(factory).ShouldHaveSingleItem();
        caught.Properties["Reason"].ToString().Trim('"').ShouldBe(reason);
        var everything = factory.Sink.Events.Select(static logEvent =>
            logEvent.RenderMessage(CultureInfo.InvariantCulture) + " " + string.Join(' ', logEvent.Properties.Values.Select(static value => value.ToString()))).ToList();
        foreach (var secret in new[] { "Juan", "0917", "639171234567", "hello-bot-text", "logo.png" })
        {
            everything.ShouldNotContain(line => line.Contains(secret, StringComparison.OrdinalIgnoreCase), $"no log line holds {secret}");
        }
    }

    private static async Task<Guid> IdAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.GetProperty("id").GetGuid();
    }

    // The member names, and for the photo slots their numbers and names: everything but the made-up id.
    private static async Task<string> ShapeAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var names = string.Join(',', document.RootElement.EnumerateObject().Select(static property => property.Name));
        var slots = string.Join(',', document.RootElement.GetProperty("photoSlots").EnumerateArray().Select(static slot => $"{slot.GetProperty("slot").GetInt32()}:{slot.GetProperty("fileName").GetString()}"));
        return $"{names}|{slots}";
    }
}

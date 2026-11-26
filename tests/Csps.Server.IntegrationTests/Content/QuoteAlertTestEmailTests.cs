using System.Globalization;
using System.Net;
using Csps.Application.Email;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.RateLimiting;
using Csps.Server.Security;
using Csps.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Serilog.Events;
using Serilog.Formatting.Compact;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// D-11, T-13-39, T-13-40, T-13-41: a Manager sends a test email to the saved Quote alerts address. It is queued and audited in one
/// save, and neither the audit detail nor the log holds the address (CWE-532). No saved address is a 409, an Admin gets 403, and one
/// address may send 3 tests in 10 minutes.
/// </summary>
public sealed class QuoteAlertTestEmailTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/site-settings/quote-alerts/test";
    private const string Alerts = "quote.alerts.test@example.com";

    [Fact]
    public async Task AManagerQueuesTheTestToTheSavedAddressAndItIsAuditedWithoutTheAddress()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(Alerts);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        using var client = factory.CreateClient();

        using var response = await SendAsync(client, manager);

        response.StatusCode.ShouldBe(HttpStatusCode.Accepted, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var row = (await context.EmailOutbox.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        (row.Kind, row.ToAddress).ShouldBe((AuthEmailKind.QuoteAlertTest, Alerts));
        var mail = (await AuthClient.WaitForEmailsAsync(client, Alerts)).ShouldHaveSingleItem();
        mail.Subject.ShouldBe("Test: quote alerts work");
        mail.Text.ShouldContain("This is a test from your website.");

        var entry = (await context.AuditLog.AsNoTracking()
            .Where(audit => audit.Action == "quote-alerts.test-sent" && audit.ActorUserId == manager.UserId)
            .ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        (entry.ActorUserId, entry.TargetType, entry.TargetId).ShouldBe((manager.UserId, "SiteSettings", "1"));
        (entry.Detail ?? string.Empty).ShouldNotContain("example.com");
        string.Join('\n', factory.Sink.Events.Select(Render)).ShouldNotContain(Alerts);
    }

    [Fact]
    public async Task NoSavedAddressAnswers409AndQueuesNothing()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(string.Empty);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        using var client = factory.CreateClient();

        using var response = await SendAsync(client, manager);

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("site-settings.no-quote-alerts-address");
        problem.GetProperty("detail").GetString().ShouldBe("Save an address first, then send a test.");
        await using var context = database.CreateContext();
        (await context.EmailOutbox.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AuditLog.CountAsync(audit => audit.Action == "quote-alerts.test-sent" && audit.ActorUserId == manager.UserId, TestContext.Current.CancellationToken))
            .ShouldBe(0);
    }

    [Fact]
    public async Task AnAddressThatCanNeverReceiveMailAnswers422AndQueuesNothing()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync("quotes@example.invalid");
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        using var client = factory.CreateClient();

        using var response = await SendAsync(client, manager);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString()
            .ShouldBe("site-settings.quote-alerts-address-undeliverable");
        await using var context = database.CreateContext();
        (await context.EmailOutbox.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnAdminGets403AndNothingIsQueued()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(Alerts);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        using var client = factory.CreateClient();

        using var response = await SendAsync(client, admin);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        await using var context = database.CreateContext();
        (await context.EmailOutbox.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TheActionCarriesTheQuoteAlertTestPolicy()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var action = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Single(endpoint => endpoint.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName == "SendQuoteAlertTest");

        action.Metadata.GetMetadata<EnableRateLimitingAttribute>().ShouldNotBeNull().PolicyName.ShouldBe("quote-alerts-test");
    }

    [Fact]
    public async Task TheFourthTestFromOneAddressWithinTenMinutesIs429WithAWholeSecondRetryAfter()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(Alerts);
        await using var factory = new RealLimitsFactory(database.ConnectionString) { RemoteIpFromHeader = true };
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        using var client = factory.CreateClient();

        for (var attempt = 1; attempt <= 3; attempt++)
        {
            using var inside = await SendAsync(client, manager, "203.0.113.150");
            inside.StatusCode.ShouldBe(HttpStatusCode.Accepted, $"test {attempt} is inside the limit");
        }

        using var rejected = await SendAsync(client, manager, "203.0.113.150");
        using var other = await SendAsync(client, manager, "203.0.113.151");

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        (await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("rate-limited");
        var wait = rejected.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds;
        wait.ShouldBeInRange(1, 600);
        (wait % 1).ShouldBe(0, "Retry-After is whole seconds");
        other.StatusCode.ShouldBe(HttpStatusCode.Accepted, "another address is not affected");
        await using var context = database.CreateContext();
        (await context.EmailOutbox.CountAsync(row => row.Kind == AuthEmailKind.QuoteAlertTest, TestContext.Current.CancellationToken))
            .ShouldBe(4, "the refused test queued nothing");
    }

    [Theory]
    [InlineData("RateLimits:QuoteAlertTest:PermitLimit", "0", "RateLimits:QuoteAlertTest:PermitLimit must be at least 1.")]
    [InlineData("RateLimits:QuoteAlertTest:Window", "00:00:01", "RateLimits:QuoteAlertTest:Window must be at least 6 seconds.")]
    public async Task AnUnusableLimitStopsStartUpAndNamesTheSettingNotTheValue(string key, string value, string message)
    {
        await using var factory = new RealLimitsFactory(new Dictionary<string, string> { [key] = value });

        var failure = Should.Throw<InvalidOperationException>(() => factory.CreateClient());

        failure.Message.ShouldContain(message);
        failure.Message.ShouldNotContain($"={value}");
    }

    [Fact]
    public void TheDefaultIsThreeInTenMinutesInItsOwnSection()
    {
        var rule = QuoteAlertTestRateLimit.Default();

        (rule.PermitLimit, rule.Window).ShouldBe((3, TimeSpan.FromMinutes(10)));
        RateLimitRule.Problems(rule, QuoteAlertTestRateLimit.SectionName).ShouldBeEmpty();
        QuoteAlertTestRateLimit.SectionName.ShouldBe("RateLimits:QuoteAlertTest");
        RateLimitPolicies.QuoteAlertTest.ShouldBe("quote-alerts-test");
    }

    private async Task SetAlertsAddressAsync(string address)
    {
        await using var context = database.CreateContext();
        await context.SiteSettings.ExecuteUpdateAsync(set => set.SetProperty(row => row.QuoteAlertsEmail, address), TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> SendAsync(HttpClient client, StartedSession? who, string? address = null)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, Route, who?.AccessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        if (address is not null)
        {
            request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static string Render(LogEvent logEvent)
    {
        using var writer = new StringWriter(CultureInfo.InvariantCulture);
        new CompactJsonFormatter().Format(logEvent, writer);
        return writer + " " + logEvent.Exception;
    }
}

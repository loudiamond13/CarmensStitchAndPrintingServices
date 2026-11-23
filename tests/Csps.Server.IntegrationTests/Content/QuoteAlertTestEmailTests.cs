using System.Globalization;
using System.Net;
using Csps.Application.Email;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Serilog.Events;
using Serilog.Formatting.Compact;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// D-11, T-13-39, T-13-41: a Manager sends a test email to the saved Quote alerts address. It is queued and audited in one save,
/// and neither the audit detail nor the log holds the address (CWE-532).
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
            .Where(audit => audit.Action == "quote-alerts.test-sent")
            .ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        (entry.ActorUserId, entry.TargetType, entry.TargetId).ShouldBe((manager.UserId, "SiteSettings", "1"));
        (entry.Detail ?? string.Empty).ShouldNotContain("example.com");
        string.Join('\n', factory.Sink.Events.Select(Render)).ShouldNotContain(Alerts);
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

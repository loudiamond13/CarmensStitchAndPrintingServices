using System.Net;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.QuoteRequests;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>INQ-04, D-07, D-08, D-10, D-12: a saved request queues one alert to the Quote alerts address in the same transaction, and nothing else is ever mailed.</summary>
public sealed class QuoteAlertEmailTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Alerts = "quotes@example.com";

    [Fact]
    public async Task ASavedRequestEmailsTheAlertsAddress()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(Alerts);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["teamName"] = "Riverside Riders";
        body["photos"] = new[] { "one.png", "two.png", "three.png" };
        body["uploadKey"] = QuoteRequestFixtures.NewUploadKey();

        using var response = await QuoteRequestFixtures.PostAsync(client, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var request = await context.Set<QuoteRequest>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        var rows = await context.EmailOutbox.AsNoTracking().Where(row => row.Kind == AuthEmailKind.QuoteAlert).ToListAsync(TestContext.Current.CancellationToken);
        rows.ShouldHaveSingleItem().ToAddress.ShouldBe(Alerts);
        var mail = (await AuthClient.WaitForEmailsAsync(client, Alerts)).ShouldHaveSingleItem();
        mail.Subject.ShouldBe("New quote request from Juan Dela Cruz");
        mail.Html.ShouldContain("Juan Dela Cruz");
        mail.Html.ShouldContain($"/admin/quote-requests/{request.Id:D}\"");
        mail.Text.ShouldContain("Photos: 3");
        mail.Text.ShouldContain($"/admin/quote-requests/{request.Id:D}");
        mail.Html.ShouldNotContain("cloudinary");
    }

    [Fact]
    public async Task NoAddressNoEmail()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(string.Empty);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await QuoteRequestFixtures.PostAsync(client, QuoteRequestFixtures.MinimalBody());

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.EmailOutbox.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ARolledBackRequestQueuesNothing()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(Alerts);
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            var real = services.Single(descriptor => descriptor.ServiceType == typeof(IEmailOutbox)).ImplementationType.ShouldNotBeNull();
            services.RemoveAll<IEmailOutbox>();
            services.AddScoped<IEmailOutbox>(provider => new FailsAfterQueuing((IEmailOutbox)ActivatorUtilities.CreateInstance(provider, real)));
        }));
        using var client = factory.CreateClient();

        using var response = await QuoteRequestFixtures.PostAsync(client, QuoteRequestFixtures.MinimalBody());

        response.StatusCode.ShouldBe(HttpStatusCode.InternalServerError);
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.EmailOutbox.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnAddressThatCannotReceiveMailNeverLosesTheRequest()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync("quotes@example.invalid");
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await QuoteRequestFixtures.PostAsync(client, QuoteRequestFixtures.MinimalBody());

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.EmailOutbox.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task CaughtAndRefusedSendsQueueNothing()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(Alerts);
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting("QuoteRequests:PerSenderPerDay", "1"));
        using var client = factory.CreateClient();
        var bot = QuoteRequestFixtures.MinimalBody();
        bot["subjectLine"] = "hello-bot-text";

        using var caught = await QuoteRequestFixtures.PostAsync(client, bot);
        using var saved = await QuoteRequestFixtures.PostAsync(client, QuoteRequestFixtures.MinimalBody());
        using var refused = await QuoteRequestFixtures.PostAsync(client, QuoteRequestFixtures.MinimalBody());

        caught.StatusCode.ShouldBe(HttpStatusCode.OK, "a caught bot sees the normal answer");
        saved.StatusCode.ShouldBe(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        refused.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.EmailOutbox.CountAsync(row => row.Kind == AuthEmailKind.QuoteAlert, TestContext.Current.CancellationToken))
            .ShouldBe(1, "only the saved request is announced");
    }

    [Fact]
    public async Task TheVisitorsOwnAddressIsNeverMailed()
    {
        await database.ResetAsync();
        await SetAlertsAddressAsync(Alerts);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["email"] = "visitor@example.org";

        using var response = await QuoteRequestFixtures.PostAsync(client, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await AuthClient.WaitForEmailsAsync(client, Alerts);
        await using var context = database.CreateContext();
        var rows = await context.EmailOutbox.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
        rows.ShouldAllBe(row => row.ToAddress == Alerts);
        (await AuthClient.ReadEmailsAsync(client, "visitor@example.org")).ShouldBeEmpty();
    }

    private async Task SetAlertsAddressAsync(string address)
    {
        await using var context = database.CreateContext();
        await context.SiteSettings.ExecuteUpdateAsync(set => set.SetProperty(row => row.QuoteAlertsEmail, address), TestContext.Current.CancellationToken);
    }

    // Queues the mail, then fails, so the save must roll the request back too.
    private sealed class FailsAfterQueuing(IEmailOutbox inner) : IEmailOutbox
    {
        public async ValueTask EnqueueAsync(AuthEmail email, CancellationToken cancellationToken)
        {
            await inner.EnqueueAsync(email, cancellationToken);
            throw new InvalidOperationException("Forced failure after the alert was queued.");
        }

        public Task<int> CountRecentAsync(AuthEmailKind kind, string toAddress, DateTimeOffset since, CancellationToken cancellationToken) =>
            inner.CountRecentAsync(kind, toAddress, since, cancellationToken);

        public Task<int> ScrubRecipientAsync(string oldAddress, string replacement, DateTimeOffset now, CancellationToken cancellationToken) =>
            inner.ScrubRecipientAsync(oldAddress, replacement, now, cancellationToken);
    }
}

using System.Net;
using System.Text.Json;
using Csps.Domain.QuoteRequests;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>INQ-01, SEC-08, CWE-915: an anonymous visitor's quote text is saved as a New request with no creator.</summary>
public sealed class CreateQuoteRequestTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task TheTextIsSavedAsANewRequest()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await QuoteRequestFixtures.PostAsync(client, QuoteRequestFixtures.MinimalBody());
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var id = document.RootElement.GetProperty("id").GetGuid();
        await using var context = database.CreateContext();
        var row = await context.Set<QuoteRequest>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        row.Id.ShouldBe(id);
        row.Status.ShouldBe(QuoteRequestStatus.New);
        row.CustomerName.ShouldBe("Juan Dela Cruz");
        row.ContactNumberE164.ShouldBe("+639171234567");
        row.CreatedById.ShouldBeNull();
    }

    [Fact]
    public async Task ForgedStampsAreIgnored()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["createdById"] = Guid.NewGuid();
        body["createdAtUtc"] = "1999-01-01T00:00:00Z";
        body["updatedById"] = Guid.NewGuid();
        body["status"] = "converted";
        body["orderId"] = Guid.NewGuid();
        var before = TimeProvider.System.GetUtcNow();

        using var response = await QuoteRequestFixtures.PostAsync(client, body);

        var after = TimeProvider.System.GetUtcNow();
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var row = await context.Set<QuoteRequest>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        row.CreatedById.ShouldBeNull();
        row.CreatedAtUtc.ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        row.Status.ShouldBe(QuoteRequestStatus.New);
    }

    [Fact]
    public async Task AReplayReturnsTheSameAnswer()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var key = Guid.NewGuid();

        using var first = await QuoteRequestFixtures.PostAsync(client, QuoteRequestFixtures.MinimalBody(), key);
        using var second = await QuoteRequestFixtures.PostAsync(client, QuoteRequestFixtures.MinimalBody(), key);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        var firstText = await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var secondText = await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        secondText.ShouldBe(firstText);
        second.Headers.GetValues("Idempotent-Replayed").ShouldBe(["true"]);
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task TwoCreatesAtOnceAreBothSaved()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        var (first, second) = await ConcurrentRequests.SendTogetherAsync(
            () => QuoteRequestFixtures.PostAsync(client, QuoteRequestFixtures.MinimalBody()),
            () => QuoteRequestFixtures.PostAsync(client, QuoteRequestFixtures.MinimalBody()));

        using (first)
        using (second)
        {
            first.StatusCode.ShouldBe(HttpStatusCode.OK);
            second.StatusCode.ShouldBe(HttpStatusCode.OK);
            await using var context = database.CreateContext();
            var ids = await context.Set<QuoteRequest>().AsNoTracking().Select(row => row.Id).ToListAsync(TestContext.Current.CancellationToken);
            ids.Count.ShouldBe(2);
            ids.Distinct().Count().ShouldBe(2);
        }
    }
}

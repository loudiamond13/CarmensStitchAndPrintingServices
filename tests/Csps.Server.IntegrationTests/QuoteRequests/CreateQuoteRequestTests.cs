using System.Net;
using System.Text.Json;
using Csps.Domain.QuoteRequests;
using Csps.Server.IntegrationTests.Http;
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
        var body = QuoteRequestFixtures.MinimalBody();

        using var first = await QuoteRequestFixtures.PostAsync(client, body, key);
        using var second = await QuoteRequestFixtures.PostAsync(client, body, key);

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
    public async Task EmptyOptionalFieldsAreStoredAsNull()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["teamName"] = "   ";
        body["email"] = string.Empty;
        body["productChoice"] = string.Empty;
        body["quantity"] = null;
        body["message"] = "  ";

        using var response = await QuoteRequestFixtures.PostAsync(client, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var row = await context.Set<QuoteRequest>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        row.TeamName.ShouldBeNull();
        row.Email.ShouldBeNull();
        row.ProductChoice.ShouldBeNull();
        row.ProductLineId.ShouldBeNull();
        row.ProductTitle.ShouldBeNull();
        row.QuantityRange.ShouldBeNull();
        row.Message.ShouldBeNull();
    }

    [Fact]
    public async Task EveryFieldIsSavedTrimmedWithTheVisibleLineAndItsTitle()
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["teamName"] = "  Brgy. San Roque Ballers ";
        body["email"] = " juan.dc@example.com ";
        body["productChoice"] = "line";
        body["productLineKey"] = "basketball";
        body["quantity"] = "10-20";
        body["message"] = " Need 15 jerseys by Dec 12. ";

        using var response = await QuoteRequestFixtures.PostAsync(client, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var row = await context.Set<QuoteRequest>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        row.TeamName.ShouldBe("Brgy. San Roque Ballers");
        row.Email.ShouldBe("juan.dc@example.com");
        row.ProductChoice.ShouldBe(QuoteProductChoice.Line);
        row.ProductLineId.ShouldBe(Guid.Parse("3a48a1d6-c812-4481-a6be-d7d7412484a0"));
        row.ProductTitle.ShouldBe("Basketball Jerseys");
        row.QuantityRange.ShouldBe(QuoteQuantityRange.TenToTwenty);
        row.Message.ShouldBe("Need 15 jerseys by Dec 12.");
    }

    [Theory]
    [InlineData("custom")]
    [InlineData("not-sure")]
    public async Task ACustomOrNotSureChoiceSavesNoLine(string choice)
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["productChoice"] = choice;
        body["productLineKey"] = "basketball";

        using var response = await QuoteRequestFixtures.PostAsync(client, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var row = await context.Set<QuoteRequest>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        row.ProductChoice.ShouldBe(choice == "custom" ? QuoteProductChoice.Custom : QuoteProductChoice.NotSure);
        row.ProductLineId.ShouldBeNull();
        row.ProductTitle.ShouldBeNull();
    }

    [Fact]
    public async Task AnUnknownLineKeyAnswers400OnTheLineKey()
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["productChoice"] = "line";
        body["productLineKey"] = "no-such-line";

        using var response = await QuoteRequestFixtures.PostAsync(client, body);

        await ShouldRefuseAsync(response, "productLineKey", "Choose a product from the list.");
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AHiddenLineAnswers400OnTheLineKey()
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        try
        {
            await using (var context = database.CreateContext())
            {
                await context.ProductLines.Where(line => line.Key == "volleyball")
                    .ExecuteUpdateAsync(set => set.SetProperty(line => line.IsActive, false), TestContext.Current.CancellationToken);
            }

            await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
            using var client = factory.CreateClient();
            var body = QuoteRequestFixtures.MinimalBody();
            body["productChoice"] = "line";
            body["productLineKey"] = "volleyball";

            using var response = await QuoteRequestFixtures.PostAsync(client, body);

            await ShouldRefuseAsync(response, "productLineKey", "Choose a product from the list.");
        }
        finally
        {
            await ProductLineSeeding.RestoreSixAsync(database);
        }
    }

    [Fact]
    public async Task AnUnknownChoiceOrQuantityAnswers400OnItsField()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var choice = QuoteRequestFixtures.MinimalBody();
        choice["productChoice"] = "banana";
        var quantity = QuoteRequestFixtures.MinimalBody();
        quantity["quantity"] = "7-8";

        using var badChoice = await QuoteRequestFixtures.PostAsync(client, choice);
        using var badQuantity = await QuoteRequestFixtures.PostAsync(client, quantity);

        await ShouldRefuseAsync(badChoice, "productChoice", "Choose a product from the list.");
        await ShouldRefuseAsync(badQuantity, "quantity", "Choose a quantity from the list.");
    }

    [Fact]
    public async Task ABadNumberAnswers400WithTheMessageAndSavesNothing()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["contactNumber"] = "02 8123 4567";

        using var response = await QuoteRequestFixtures.PostAsync(client, body);

        await ShouldRefuseAsync(response, "contactNumber", "Enter a mobile number, like 0917 123 4567.");
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
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

    private static async Task ShouldRefuseAsync(HttpResponseMessage response, string field, string message)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("quote-requests.validation");
        var errors = problem.GetProperty("errors");
        errors.EnumerateObject().Select(property => property.Name).ShouldBe([field]);
        errors.GetProperty(field).EnumerateArray().Select(item => item.GetString()).ShouldBe([message]);
    }
}

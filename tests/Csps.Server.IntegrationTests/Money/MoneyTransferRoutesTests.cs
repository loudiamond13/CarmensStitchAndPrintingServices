using System.Net;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Authorization;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>
/// MONEY-07, D-22, D-27, D-28, T-10-40: a transfer is never edited, restored or deleted in bulk, so the API has no PUT, PATCH,
/// restore or bulk route under <c>/api/v1/money-transfers</c>. The endpoints are listed here, so a new one fails this test until it
/// is looked at.
/// </summary>
public sealed class MoneyTransferRoutesTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Prefix = "api/v1/money-transfers";

    private static readonly string[] ExpectedEndpoints =
    [
        "DELETE /api/v1/money-transfers/{id:guid}",
        "DELETE /api/v1/money-transfers/{id:guid}/permanent",
        "GET /api/v1/money-transfers",
        "GET /api/v1/money-transfers/recipients",
        "POST /api/v1/money-transfers",
        "POST /api/v1/money-transfers/handovers",
    ];

    [Fact]
    public async Task TheMoneyTransferEndpointsAreExactlyTheListTheRecipientsTheTransferTheHandOverTheDeleteAndTheRemove()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);

        MoneyTransferKeys(factory).ShouldBe(ExpectedEndpoints);
    }

    [Fact]
    public async Task OnlyGetPostAndDeleteMethodsExistUnderMoneyTransfers()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);

        var methods = MoneyTransferKeys(factory).Select(key => key[..key.IndexOf(' ', StringComparison.Ordinal)]).Distinct().Order().ToArray();

        methods.ShouldBe(["DELETE", "GET", "POST"]);
    }

    [Fact]
    public async Task NoRouteIsARestoreOrABulkRouteAndTheCollectionItselfCannotBeDeleted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var keys = MoneyTransferKeys(factory);

        keys.ShouldNotContain(key => key.Contains("restore", StringComparison.OrdinalIgnoreCase));
        keys.ShouldNotContain(key => key.Contains("bulk", StringComparison.OrdinalIgnoreCase) || key.Contains("batch", StringComparison.OrdinalIgnoreCase));
        keys.ShouldNotContain($"DELETE /{Prefix}");
    }

    [Theory]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    public async Task AnEditAttemptOnATransferAnswers405Or404AndChangesNothing(string method)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var member = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        await MoneyFixtures.SeedPaymentAsync(database, member.UserId, $"ORD-2026-{(method == "PUT" ? "0101" : "0102")}", 800.00m, today, new DateTimeOffset(2026, 11, 4, 2, 0, 0, TimeSpan.Zero));
        var (id, version) = await MoneyFixtures.RecordTransferAsync(client, member.AccessToken, manager.UserId, 300.00m, today);

        using var request = Http.ApiRequests.Create(new HttpMethod(method), $"{MoneyFixtures.TransfersRoute}/{id:D}?version={Uri.EscapeDataString(version)}", manager.AccessToken);
        request.Content = System.Net.Http.Json.JsonContent.Create(new { amount = 1.00m, version });
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBeOneOf(HttpStatusCode.MethodNotAllowed, HttpStatusCode.NotFound);
        var stored = (await MoneyFixtures.ReadTransfersAsync(database)).Single(transfer => transfer.Id == id);
        stored.Amount.ShouldBe(300.00m);
        stored.IsDeleted.ShouldBeFalse();
    }

    private static string[] MoneyTransferKeys(CspsApiFactory factory) =>
    [
        .. factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .SelectMany(AuthorizationCoverage.KeysOf)
            .Where(key => key[(key.IndexOf(' ', StringComparison.Ordinal) + 1)..].TrimStart('/').StartsWith(Prefix, StringComparison.OrdinalIgnoreCase))
            .Order(StringComparer.Ordinal),
    ];
}

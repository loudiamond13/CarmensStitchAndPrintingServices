using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Server.IntegrationTests.OrderLists;

/// <summary>D-16, D-17, D-18, D-19, CWE-862: staff read the seeded order lists A to Z; a stranger is refused.</summary>
public sealed class ListOrderListsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string ProductTypesRoute = "/api/v1/product-types";
    private const string PaymentMethodsRoute = "/api/v1/payment-methods";
    private const string OrderExpenseCategoriesRoute = "/api/v1/order-expense-categories";

    private static readonly string[] Keys = ["id", "isOthers", "name", "status", "tone"];

    private static readonly string[] ProductTypeOrder =
    [
        "Basketball Jersey", "Custom Design", "Long Sleeves", "Moto Riding Jersey", "Polo Shirt", "Volleyball Jersey",
    ];

    [Fact]
    public Task AManagerReadsTheSixProductTypes() => StaffReadsProductTypesAsync(Roles.Manager);

    [Fact]
    public Task AnAdminReadsTheSixProductTypes() => StaffReadsProductTypesAsync(Roles.Admin);

    [Fact]
    public async Task StaffReadTheFivePaymentMethodsAToZ()
    {
        var items = await ReadAsync(database, PaymentMethodsRoute, Roles.Manager);

        items.Select(item => item.GetProperty("name").GetString()).ShouldBe(["Bank Transfer", "Cash", "Cheque", "GCash", "Maya"]);
        items.ShouldAllBe(item => item.GetProperty("status").GetString() == "active" && !item.GetProperty("isOthers").GetBoolean());
    }

    [Fact]
    public async Task StaffReadTheSixOrderExpenseCategoriesWithOthersLast()
    {
        var items = await ReadAsync(database, OrderExpenseCategoriesRoute, Roles.Admin);

        items.Select(item => item.GetProperty("name").GetString()).ShouldBe(["Delivery", "Fabric", "Ink & paper", "Labor", "Outsourcing", "Others"]);
        items.Where(item => item.GetProperty("isOthers").GetBoolean()).Select(item => item.GetProperty("name").GetString()).ShouldBe(["Others"]);
    }

    [Fact]
    public async Task ARetiredPaymentMethodIsStillListedWithStatusRetired()
    {
        var own = await CspsDatabase.CreateAsync();
        await using (own)
        {
            var connection = new SqlConnection(own.ConnectionString);
            await using (connection)
            {
                await connection.OpenAsync(TestContext.Current.CancellationToken);
                var command = connection.CreateCommand();
                await using (command)
                {
                    command.CommandText = "UPDATE PaymentMethods SET RetiredAtUtc = SYSUTCDATETIME() WHERE NormalizedName = 'MAYA';";
                    (await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
                }
            }

            var items = await ReadAsync(own, PaymentMethodsRoute, Roles.Manager);

            items.Select(item => item.GetProperty("name").GetString()).ShouldBe(["Bank Transfer", "Cash", "Cheque", "GCash", "Maya"]);
            items.Single(item => item.GetProperty("name").GetString() == "Maya").GetProperty("status").GetString().ShouldBe("retired");
            items.Count(item => item.GetProperty("status").GetString() == "active").ShouldBe(4);
        }
    }

    [Theory]
    [InlineData(PaymentMethodsRoute)]
    [InlineData(OrderExpenseCategoriesRoute)]
    public async Task AnAnonymousCallerGets401OnTheOtherLists(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(route);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AnAnonymousCallerGets401OnProductTypes()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(ProductTypesRoute);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private static async Task<IReadOnlyList<JsonElement>> ReadAsync(CspsDatabase target, string route, string role)
    {
        await using var factory = CspsApiFactory.ForDatabase(target.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(route, (await TestSessions.StartAsync(factory, role)).AccessToken);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return [.. document.RootElement.EnumerateArray().Select(static item => item.Clone())];
    }

    private async Task StaffReadsProductTypesAsync(string role)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(ProductTypesRoute, (await TestSessions.StartAsync(factory, role)).AccessToken);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var items = document.RootElement.EnumerateArray().ToList();

        items.Select(item => item.GetProperty("name").GetString()).ShouldBe(ProductTypeOrder);
        items.ShouldAllBe(item => item.GetProperty("id").GetGuid() != Guid.Empty);
        items.ShouldAllBe(item => CategoryTones.IsValid(item.GetProperty("tone").GetString()));
        items.ShouldAllBe(item => item.GetProperty("status").GetString() == "active");
        items.ShouldAllBe(item => !item.GetProperty("isOthers").GetBoolean());
        items.ShouldAllBe(item => item.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal)
            .SequenceEqual(Keys));
    }
}

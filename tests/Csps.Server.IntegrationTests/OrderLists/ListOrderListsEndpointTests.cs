using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.OrderLists;

/// <summary>D-16, D-17, D-18, D-19, CWE-862: staff read the seeded order lists A to Z; a stranger is refused.</summary>
public sealed class ListOrderListsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string ProductTypesRoute = "/api/v1/product-types";

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
    public async Task AnAnonymousCallerGets401OnProductTypes()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(ProductTypesRoute);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
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

using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// D-16, D-09: the order window lists the active product lines for either staff role through <c>GET /api/v1/product-lines/options</c>:
/// id, title and short name, in display order, with no hidden line. Anonymous callers get 401.
/// </summary>
public sealed class ProductLineOptionsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/product-lines/options";

    private static readonly string[] SeededTitles =
    [
        "Basketball Jerseys",
        "Volleyball Jerseys",
        "Moto Riding Jerseys",
        "Long Sleeves",
        "Polo Shirts",
        "Custom Designs",
    ];

    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Manager)]
    public async Task EitherStaffRoleListsTheActiveLinesInDisplayOrder(string role)
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var who = await TestSessions.StartAsync(rig.Factory, role);

        using var response = await rig.SendAsync(HttpMethod.Get, Route, who);

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var options = document.RootElement.EnumerateArray().ToList();
        options.Select(option => option.GetProperty("title").GetString()).ShouldBe(SeededTitles);
        options.Select(option => option.GetProperty("shortName").GetString()).First().ShouldBe("Basketball");
        options.ShouldAllBe(option => option.GetProperty("id").GetGuid() != Guid.Empty);
        options.ShouldAllBe(option => option.EnumerateObject().Count() == 3);
    }

    [Fact]
    public async Task AHiddenLineIsNotOffered()
    {
        await using var rig = await ProductLineRig.StartAsync(database);
        var lines = await rig.ListAsync();
        using (var hidden = await rig.HideAsync(lines[1].Id))
        {
            hidden.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var response = await rig.SendAsync(HttpMethod.Get, Route, rig.Manager);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.EnumerateArray().Select(option => option.GetProperty("id").GetGuid()).ShouldNotContain(lines[1].Id);
        document.RootElement.GetArrayLength().ShouldBe(5);
    }

    [Fact]
    public async Task AnonymousIsRefusedWith401()
    {
        await using var rig = await ProductLineRig.StartAsync(database);

        using var response = await rig.SendAsync(HttpMethod.Get, Route, who: null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Content;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>
/// D-09 to D-16, D-38, GAL-03, PUB-03, SEC-08: staff of either role record the customer's OK and show an order on the website. The consent
/// stamps come from the token and the clock, the gallery entry gives a shown order its place, and no audit entry holds customer data.
/// </summary>
public sealed class OrderPublicSettingsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly Guid BasketballLine = LineId("basketball");

    private static readonly Guid VolleyballLine = LineId("volleyball");

    [Fact]
    public async Task AnAdminTicksTheOkAndShowsACompletedOrderAndTheDetailAndTheGalleryRecordIt()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var order = await CreateCompletedOrderAsync(factory, client, admin, [(OrderFixtures.BasketballId, 10), (OrderFixtures.BasketballId, 7)]);
        var before = TimeProvider.System.GetUtcNow();

        using var response = await PutPublicAsync(client, admin.AccessToken, order.GetProperty("id").GetGuid(), PublicBody(order, consent: true, show: true));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var settings = document.RootElement.GetProperty("publicWebsite");
        settings.GetProperty("customerConsent").GetBoolean().ShouldBeTrue();
        settings.GetProperty("consentRecordedByName").GetString().ShouldBe(await NameOfAsync(admin.UserId));
        settings.GetProperty("consentRecordedAtUtc").GetDateTimeOffset().ShouldBeGreaterThanOrEqualTo(before.AddSeconds(-1));
        settings.GetProperty("shownOnWebsite").GetBoolean().ShouldBeTrue();
        settings.GetProperty("shownSinceUtc").GetDateTimeOffset().ShouldBeGreaterThanOrEqualTo(before.AddSeconds(-1));
        settings.GetProperty("productLineId").GetGuid().ShouldBe(BasketballLine);
        settings.GetProperty("autoProductLineId").GetGuid().ShouldBe(BasketballLine);
        settings.GetProperty("pieces").GetInt32().ShouldBe(17);
        (await GalleryEntryCountAsync(order.GetProperty("id").GetGuid())).ShouldBe(1);
    }

    [Fact]
    public async Task AManagerCanDoTheSameAndAnonymousIsRefusedWith401()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await CreateCompletedOrderAsync(factory, client, manager, [(OrderFixtures.BasketballId, 5)]);
        var id = order.GetProperty("id").GetGuid();

        using var anonymous = await PutPublicAsync(client, accessToken: null, id, PublicBody(order, consent: true, show: true));
        using var response = await PutPublicAsync(client, manager.AccessToken, id, PublicBody(order, consent: true, show: true));

        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await GalleryEntryCountAsync(id)).ShouldBe(1);
    }

    [Fact]
    public async Task AFreshOrderHasNoConsentAndIsNotShown()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));

        var detail = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid());

        var settings = detail.GetProperty("publicWebsite");
        settings.GetProperty("customerConsent").GetBoolean().ShouldBeFalse();
        settings.GetProperty("shownOnWebsite").GetBoolean().ShouldBeFalse();
        OrderFixtures.IsNull(settings, "consentRecordedAtUtc").ShouldBeTrue();
        OrderFixtures.IsNull(settings, "shownSinceUtc").ShouldBeTrue();
    }

    [Fact]
    public async Task AnOrderShownLaterJoinsTheGalleryAboveTheOneShownBefore()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var first = await CreateCompletedOrderAsync(factory, client, admin, [(OrderFixtures.BasketballId, 3)]);
        var second = await CreateCompletedOrderAsync(factory, client, admin, [(OrderFixtures.BasketballId, 4)]);
        using var one = await PutPublicAsync(client, admin.AccessToken, first.GetProperty("id").GetGuid(), PublicBody(first, consent: true, show: true));
        using var two = await PutPublicAsync(client, admin.AccessToken, second.GetProperty("id").GetGuid(), PublicBody(second, consent: true, show: true));

        one.StatusCode.ShouldBe(HttpStatusCode.OK);
        two.StatusCode.ShouldBe(HttpStatusCode.OK);
        var firstPosition = await GalleryPositionAsync(first.GetProperty("id").GetGuid());
        var secondPosition = await GalleryPositionAsync(second.GetProperty("id").GetGuid());
        secondPosition.ShouldBeLessThan(firstPosition);
    }

    [Fact]
    public async Task AnOtherLineChosenByStaffIsKeptAsTheOverrideWhileTheAutoLineStaysTheLinkedOne()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var order = await CreateCompletedOrderAsync(factory, client, admin, [(OrderFixtures.BasketballId, 6)]);

        using var response = await PutPublicAsync(client, admin.AccessToken, order.GetProperty("id").GetGuid(), PublicBody(order, consent: true, show: true, lineId: VolleyballLine));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var settings = document.RootElement.GetProperty("publicWebsite");
        settings.GetProperty("productLineId").GetGuid().ShouldBe(VolleyballLine);
        settings.GetProperty("autoProductLineId").GetGuid().ShouldBe(BasketballLine);
    }

    private static Guid LineId(string key) => ProductLineSeed.All.Single(entry => entry.Key == key).Id;

    private async Task<CspsApiFactory> StartAsync()
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await LinkBasketballAsync();
        return CspsApiFactory.ForDatabase(database.ConnectionString);
    }

    // Files the Basketball Jersey product type under the basketball line, so an order of jerseys has an auto line.
    private async Task LinkBasketballAsync()
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var type = await context.ProductTypes.SingleAsync(row => row.Id == OrderFixtures.BasketballId, TestContext.Current.CancellationToken);
            type.LinkToLine(BasketballLine);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
    }

    // A Completed order with no money owed: the items cost nothing, so the balance is zero and the order can be completed.
    private static async Task<JsonElement> CreateCompletedOrderAsync(CspsApiFactory factory, HttpClient client, StartedSession who, (Guid ProductTypeId, int Quantity)[] items)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(items[0].ProductTypeId, today);
        body["items"] = items.Select(item => OrderFixtures.Item(item.ProductTypeId, "Sample piece", null, item.Quantity, 0.00m)).ToArray();
        var created = await OrderFixtures.CreateAsync(client, who.AccessToken, body);
        return await OrderFixtures.ChangeStatusAndReadAsync(client, who.AccessToken, created.GetProperty("id").GetGuid(), "completed");
    }

    private static Dictionary<string, object?> PublicBody(JsonElement order, bool consent, bool show, Guid? lineId = null, string? name = null) => new()
    {
        ["version"] = order.GetProperty("version").GetString(),
        ["customerConsent"] = consent,
        ["showOnWebsite"] = show,
        ["productLineId"] = lineId,
        ["publicName"] = name,
    };

    private static async Task<HttpResponseMessage> PutPublicAsync(HttpClient client, string? accessToken, Guid orderId, object? body)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, $"{OrderFixtures.Route}/{orderId:D}/public", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private async Task<string> NameOfAsync(Guid userId)
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var user = await context.Users.AsNoTracking().SingleAsync(row => row.Id == userId, TestContext.Current.CancellationToken);
            return $"{user.FirstName} {user.LastName}";
        }
    }

    private async Task<int> GalleryEntryCountAsync(Guid orderId)
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            return await context.Database
                .SqlQuery<int>($"SELECT COUNT(*) AS [Value] FROM dbo.GalleryEntries WHERE OrderId = {orderId}")
                .SingleAsync(TestContext.Current.CancellationToken);
        }
    }

    private async Task<int> GalleryPositionAsync(Guid orderId)
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            return await context.Database
                .SqlQuery<int>($"SELECT [Position] AS [Value] FROM dbo.GalleryEntries WHERE OrderId = {orderId}")
                .SingleAsync(TestContext.Current.CancellationToken);
        }
    }
}

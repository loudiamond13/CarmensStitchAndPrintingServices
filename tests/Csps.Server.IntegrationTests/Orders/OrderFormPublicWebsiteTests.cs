using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Content;
using Csps.Server.IntegrationTests.Content;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>
/// UI-SPEC F1 and F2, D-11, D-16, D-38, GAL-03, AUDIT-01: the order form carries the customer's OK and Show on the website with the order,
/// under the same rules and messages as the order window. The consent stamps come from the token and the clock, and a request without
/// the block leaves the public settings as they were (off for a new order).
/// </summary>
public sealed class OrderFormPublicWebsiteTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly Guid BasketballLine = PublicGalleryRig.LineId("basketball");

    private static readonly Guid VolleyballLine = PublicGalleryRig.LineId("volleyball");

    [Fact]
    public async Task AnAdminCreatesAnOrderWithTheOkAndShowOnTheWebsiteAndItIsInThePublicGalleryOncePhotographed()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);
        var before = TimeProvider.System.GetUtcNow();
        var body = await NewBodyAsync(rig, items: [10, 7]);
        body["publicWebsite"] = Block(consent: true, show: true);

        using var response = await OrderFixtures.PostAsync(client, admin.AccessToken, body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var created = JsonDocument.Parse(text);
        var id = created.RootElement.GetProperty("id").GetGuid();
        var settings = created.RootElement.GetProperty("publicWebsite");
        settings.GetProperty("customerConsent").GetBoolean().ShouldBeTrue();
        settings.GetProperty("consentRecordedByName").GetString().ShouldBe(await NameOfAsync(admin.UserId));
        settings.GetProperty("consentRecordedAtUtc").GetDateTimeOffset().ShouldBeGreaterThanOrEqualTo(before.AddSeconds(-1));
        settings.GetProperty("shownOnWebsite").GetBoolean().ShouldBeTrue();
        settings.GetProperty("productLineId").GetGuid().ShouldBe(BasketballLine);
        settings.GetProperty("autoProductLineId").GetGuid().ShouldBe(BasketballLine);
        settings.GetProperty("pieces").GetInt32().ShouldBe(17);
        (await GalleryEntryCountAsync(id)).ShouldBe(1);

        await rig.UploadPhotoAsync(id, 800, 600);
        var (gallery, _) = await rig.GalleryAsync();
        using (gallery)
        {
            var item = gallery.RootElement.GetProperty("items").EnumerateArray().ShouldHaveSingleItem();
            item.GetProperty("team").GetString().ShouldBe("Brgy. San Roque Ballers");
            item.GetProperty("lineKey").GetString().ShouldBe("basketball");
            item.GetProperty("pieces").GetInt32().ShouldBe(17);
        }
    }

    [Fact]
    public async Task ACreateWithoutTheBlockHasNoConsentAndIsNotShown()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);

        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, await NewBodyAsync(rig, items: [5]));

        var settings = created.GetProperty("publicWebsite");
        settings.GetProperty("customerConsent").GetBoolean().ShouldBeFalse();
        settings.GetProperty("shownOnWebsite").GetBoolean().ShouldBeFalse();
        (await GalleryEntryCountAsync(created.GetProperty("id").GetGuid())).ShouldBe(0);
    }

    [Fact]
    public async Task ACreateWithTheOkAndNoShowRecordsTheOkAndPutsNothingInTheGallery()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();
        var manager = rig.Manager;
        var body = await NewBodyAsync(rig, items: [5]);
        body["publicWebsite"] = Block(consent: true, show: false);

        var created = await OrderFixtures.CreateAsync(client, manager.AccessToken, body);

        var settings = created.GetProperty("publicWebsite");
        settings.GetProperty("customerConsent").GetBoolean().ShouldBeTrue();
        settings.GetProperty("shownOnWebsite").GetBoolean().ShouldBeFalse();
        (await GalleryEntryCountAsync(created.GetProperty("id").GetGuid())).ShouldBe(0);
    }

    [Fact]
    public async Task ALineAndANameChosenOnTheFormAreKeptAndTheAutoLineStaysTheLinkedOne()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();
        var body = await NewBodyAsync(rig, items: [6]);
        body["publicWebsite"] = Block(consent: true, show: true, lineId: VolleyballLine, name: "Display Name");

        var created = await OrderFixtures.CreateAsync(client, rig.Manager.AccessToken, body);

        var settings = created.GetProperty("publicWebsite");
        settings.GetProperty("productLineId").GetGuid().ShouldBe(VolleyballLine);
        settings.GetProperty("autoProductLineId").GetGuid().ShouldBe(BasketballLine);
        settings.GetProperty("publicName").GetString().ShouldBe("Display Name");
    }

    [Fact]
    public async Task ShowingWithoutTheOkIsA400OnTheShowFlagAndNoOrderIsSaved()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();
        var body = await NewBodyAsync(rig, items: [5]);
        body["customerName"] = "Refused Customer One";
        body["publicWebsite"] = Block(consent: false, show: true);

        using var response = await OrderFixtures.PostAsync(client, rig.Manager.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.FieldErrors(problem, "publicWebsite.showOnWebsite").ShouldBe(["Tick Customer said OK to show first."]);
        (await OrderCountForAsync("Refused Customer One")).ShouldBe(0);
    }

    [Fact]
    public async Task ANameOverEightyCharactersIsA400OnTheNameField()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();
        var body = await NewBodyAsync(rig, items: [5]);
        body["customerName"] = "Refused Customer Two";
        body["publicWebsite"] = Block(consent: true, show: false, name: new string('n', 81));

        using var response = await OrderFixtures.PostAsync(client, rig.Manager.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken), "publicWebsite.publicName")
            .ShouldBe(["Keep the name to 80 characters or fewer."]);
        (await OrderCountForAsync("Refused Customer Two")).ShouldBe(0);
    }

    [Fact]
    public async Task AnOrderWithNoTeamNeedsANameAndAnUnknownLineIsRefusedAndNothingIsSaved()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();
        var noName = await NewBodyAsync(rig, items: [5]);
        noName["customerName"] = "Refused Customer Three";
        noName["teamName"] = null;
        noName["publicWebsite"] = Block(consent: true, show: true);
        var unknownLine = await NewBodyAsync(rig, items: [5]);
        unknownLine["customerName"] = "Refused Customer Four";
        unknownLine["publicWebsite"] = Block(consent: true, show: false, lineId: Guid.NewGuid());

        using var first = await OrderFixtures.PostAsync(client, rig.Manager.AccessToken, noName);
        using var second = await OrderFixtures.PostAsync(client, rig.Manager.AccessToken, unknownLine);

        first.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(first, TestContext.Current.CancellationToken), "publicWebsite.publicName")
            .ShouldBe(["This order has no team name. Enter the name to show."]);
        second.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(second, TestContext.Current.CancellationToken), "publicWebsite.productLineId")
            .ShouldBe(["Choose the product line to show this order under."]);
        (await OrderCountForAsync("Refused Customer Three")).ShouldBe(0);
        (await OrderCountForAsync("Refused Customer Four")).ShouldBe(0);
    }

    [Fact]
    public async Task AConsentTimeAndPersonSentInsideTheBlockAreIgnored()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);
        var before = TimeProvider.System.GetUtcNow();
        var block = Block(consent: true, show: true);
        block["consentRecordedAtUtc"] = "2020-01-01T00:00:00Z";
        block["publicConsentAtUtc"] = "2020-01-01T00:00:00Z";
        block["publicConsentById"] = rig.Manager.UserId;
        block["consentRecordedByName"] = "Someone Else";
        block["shownSinceUtc"] = "2020-01-01T00:00:00Z";
        var body = await NewBodyAsync(rig, items: [5]);
        body["publicWebsite"] = block;

        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, body);

        var settings = created.GetProperty("publicWebsite");
        settings.GetProperty("consentRecordedByName").GetString().ShouldBe(await NameOfAsync(admin.UserId));
        settings.GetProperty("consentRecordedAtUtc").GetDateTimeOffset().ShouldBeGreaterThanOrEqualTo(before.AddSeconds(-1));
        settings.GetProperty("shownSinceUtc").GetDateTimeOffset().ShouldBeGreaterThanOrEqualTo(before.AddSeconds(-1));
    }

    [Fact]
    public async Task ACreateWithTheBlockWritesTheCreatedEntryAndTheOkAndShownEntriesAndNoCustomerData()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);
        var body = await NewBodyAsync(rig, items: [5]);
        body["publicWebsite"] = Block(consent: true, show: true, lineId: VolleyballLine, name: "Display Name");

        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, body);

        var id = created.GetProperty("id").GetGuid();
        var number = created.GetProperty("number").GetString()!;
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var entries = await context.AuditLog.AsNoTracking()
                .Where(row => row.ActorUserId == admin.UserId && row.TargetId == id.ToString("D") && row.TargetType == "Order")
                .Select(row => new { row.Action, row.Detail })
                .ToListAsync(TestContext.Current.CancellationToken);
            entries.Select(row => row.Action).Order(StringComparer.Ordinal).ShouldBe(
                [
                    "order.created",
                    "order.public-consent-recorded",
                    "order.public-details-changed",
                    "order.shown-on-website",
                ]);
            foreach (var entry in entries.Where(row => row.Action != "order.created"))
            {
                entry.Detail.ShouldNotBeNull().ShouldContain($"number={number}");
                entry.Detail.ShouldNotContain("Juan");
                entry.Detail.ShouldNotContain("0917");
                entry.Detail.ShouldNotContain("example.com");
                entry.Detail.ShouldNotContain("Display Name");
            }
        }
    }

    [Fact]
    public async Task ACreateWithAnEmptyBlockWritesNoPublicAuditEntryAndNoGalleryEntry()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        using var client = rig.Factory.CreateClient();
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);
        var body = await NewBodyAsync(rig, items: [5]);
        body["publicWebsite"] = Block(consent: false, show: false);

        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, body);

        var id = created.GetProperty("id").GetGuid();
        (await GalleryEntryCountAsync(id)).ShouldBe(0);
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var actions = await context.AuditLog.AsNoTracking()
                .Where(row => row.ActorUserId == admin.UserId && row.TargetId == id.ToString("D") && row.TargetType == "Order")
                .Select(row => row.Action)
                .ToListAsync(TestContext.Current.CancellationToken);
            actions.ShouldBe(["order.created"]);
        }
    }

    // A valid create body whose items are Basketball Jersey lines of the given quantities, free of charge.
    private static async Task<Dictionary<string, object?>> NewBodyAsync(PublicGalleryRig rig, int[] items)
    {
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, await OrderFixtures.TodayAsync(rig.Factory));
        body["items"] = items.Select(quantity => OrderFixtures.Item(OrderFixtures.BasketballId, "Sample piece", null, quantity, 0.00m)).ToArray();
        return body;
    }

    private static Dictionary<string, object?> Block(bool consent, bool show, Guid? lineId = null, string? name = null) => new()
    {
        ["customerConsent"] = consent,
        ["showOnWebsite"] = show,
        ["productLineId"] = lineId,
        ["publicName"] = name,
    };

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
            return await context.GalleryEntries.AsNoTracking().CountAsync(entry => entry.OrderId == orderId, TestContext.Current.CancellationToken);
        }
    }

    private async Task<int> OrderCountForAsync(string customerName)
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            return await context.Orders.IgnoreQueryFilters().AsNoTracking().CountAsync(order => order.CustomerName == customerName, TestContext.Current.CancellationToken);
        }
    }
}

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

    [Fact]
    public async Task ShowingWithoutTheOkIsA400OnTheShowFlagAndStoresNothing()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var order = await CreateCompletedOrderAsync(factory, client, admin, [(OrderFixtures.BasketballId, 5)]);
        var id = order.GetProperty("id").GetGuid();

        using var response = await PutPublicAsync(client, admin.AccessToken, id, PublicBody(order, consent: false, show: true));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.FieldErrors(problem, "showOnWebsite").ShouldBe(["Tick Customer said OK to show first."]);
        (await GalleryEntryCountAsync(id)).ShouldBe(0);
        var stored = await OrderFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        stored.GetProperty("publicWebsite").GetProperty("customerConsent").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task ACancelledOrderAnswers422WithTheCancelledMessage()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, created.GetProperty("id").GetGuid(), "cancelled");

        using var response = await PutPublicAsync(client, admin.AccessToken, cancelled.GetProperty("id").GetGuid(), PublicBody(cancelled, consent: true, show: true));

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.public-cancelled");
        problem.GetProperty("detail").GetString().ShouldBe("Cancelled orders can't be shown on the website.");
        cancelled.GetProperty("publicWebsite").GetProperty("canShow").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task AnOrderWithNoTeamNeedsANameAndAnUnknownLineIsRefused()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["teamName"] = null;
        var created = await OrderFixtures.CreateAsync(client, admin.AccessToken, body);
        var id = created.GetProperty("id").GetGuid();

        using var noName = await PutPublicAsync(client, admin.AccessToken, id, PublicBody(created, consent: true, show: true));
        using var unknownLine = await PutPublicAsync(client, admin.AccessToken, id, PublicBody(created, consent: true, show: false, lineId: Guid.NewGuid()));
        using var named = await PutPublicAsync(client, admin.AccessToken, id, PublicBody(created, consent: true, show: true, name: "Tondo Riders MC"));

        noName.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(noName, TestContext.Current.CancellationToken), "publicName")
            .ShouldBe(["This order has no team name. Enter the name to show."]);
        unknownLine.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(unknownLine, TestContext.Current.CancellationToken), "productLineId")
            .ShouldBe(["Choose the product line to show this order under."]);
        named.StatusCode.ShouldBe(HttpStatusCode.OK, await named.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AStaleVersionIs409AndAnUnknownOrderIs404()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var order = await CreateCompletedOrderAsync(factory, client, admin, [(OrderFixtures.BasketballId, 5)]);
        var id = order.GetProperty("id").GetGuid();
        using (var first = await PutPublicAsync(client, admin.AccessToken, id, PublicBody(order, consent: true, show: false)))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using var stale = await PutPublicAsync(client, admin.AccessToken, id, PublicBody(order, consent: true, show: true));
        using var missing = await PutPublicAsync(client, admin.AccessToken, Guid.NewGuid(), PublicBody(order, consent: true, show: true));

        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(stale, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        (await GalleryEntryCountAsync(id)).ShouldBe(0);
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AConsentTimeAndPersonSentByTheClientAreIgnored()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var other = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await CreateCompletedOrderAsync(factory, client, admin, [(OrderFixtures.BasketballId, 5)]);
        var body = PublicBody(order, consent: true, show: true);
        body["publicConsentAtUtc"] = "2020-01-01T00:00:00Z";
        body["consentRecordedAtUtc"] = "2020-01-01T00:00:00Z";
        body["publicConsentById"] = other.UserId;
        body["consentRecordedByName"] = "Someone Else";
        body["shownSinceUtc"] = "2020-01-01T00:00:00Z";
        var before = TimeProvider.System.GetUtcNow();

        using var response = await PutPublicAsync(client, admin.AccessToken, order.GetProperty("id").GetGuid(), body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var settings = document.RootElement.GetProperty("publicWebsite");
        settings.GetProperty("consentRecordedByName").GetString().ShouldBe(await NameOfAsync(admin.UserId));
        settings.GetProperty("consentRecordedAtUtc").GetDateTimeOffset().ShouldBeGreaterThanOrEqualTo(before.AddSeconds(-1));
        settings.GetProperty("shownSinceUtc").GetDateTimeOffset().ShouldBeGreaterThanOrEqualTo(before.AddSeconds(-1));
    }

    [Fact]
    public async Task EachChangeWritesItsAuditEntryNamingTheOrderAndNeverTheCustomer()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var order = await CreateCompletedOrderAsync(factory, client, admin, [(OrderFixtures.BasketballId, 5)]);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString()!;

        var recorded = await SaveAsync(client, admin, id, PublicBody(order, consent: true, show: false));
        var shown = await SaveAsync(client, admin, id, PublicBody(recorded, consent: true, show: true));
        var changed = await SaveAsync(client, admin, id, PublicBody(shown, consent: true, show: true, lineId: VolleyballLine, name: "Display Name"));
        var removed = await SaveAsync(client, admin, id, PublicBody(changed, consent: false, show: false, lineId: VolleyballLine, name: "Display Name"));
        var again = await SaveAsync(client, admin, id, PublicBody(removed, consent: false, show: false, lineId: VolleyballLine, name: "Display Name"));

        again.GetProperty("version").GetString().ShouldBe(removed.GetProperty("version").GetString());
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var entries = await context.AuditLog.AsNoTracking()
                .Where(row => row.ActorUserId == admin.UserId && row.TargetId == id.ToString("D") && row.TargetType == "Order" && row.Action != "order.created" && row.Action != "order.status-changed")
                .Select(row => new { row.Action, row.Detail })
                .ToListAsync(TestContext.Current.CancellationToken);
            entries.Select(row => row.Action).Order(StringComparer.Ordinal).ShouldBe(
                [
                    "order.public-consent-recorded",
                    "order.public-consent-removed",
                    "order.public-details-changed",
                    "order.shown-on-website",
                    "order.taken-off-website",
                ]);
            foreach (var entry in entries)
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
    public async Task TakingAnOrderOffTheWebsiteRemovesItsEntryAndKeepsTheOk()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var order = await CreateCompletedOrderAsync(factory, client, admin, [(OrderFixtures.BasketballId, 5)]);
        var id = order.GetProperty("id").GetGuid();
        var shown = await SaveAsync(client, admin, id, PublicBody(order, consent: true, show: true));
        (await GalleryEntryCountAsync(id)).ShouldBe(1);

        var off = await SaveAsync(client, admin, id, PublicBody(shown, consent: true, show: false));

        (await GalleryEntryCountAsync(id)).ShouldBe(0);
        var settings = off.GetProperty("publicWebsite");
        settings.GetProperty("shownOnWebsite").GetBoolean().ShouldBeFalse();
        settings.GetProperty("customerConsent").GetBoolean().ShouldBeTrue();
        OrderFixtures.IsNull(settings, "shownSinceUtc").ShouldBeTrue();
    }

    [Fact]
    public async Task APublicDetailNeverHoldsTheCustomerBeyondTheOrderItself()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var order = await CreateCompletedOrderAsync(factory, client, admin, [(OrderFixtures.BasketballId, 5)]);

        var saved = await SaveAsync(client, admin, order.GetProperty("id").GetGuid(), PublicBody(order, consent: true, show: true));

        var settings = saved.GetProperty("publicWebsite").GetRawText();
        settings.ShouldNotContain("Juan");
        settings.ShouldNotContain("0917");
        settings.ShouldNotContain("example.com");
    }

    [Fact]
    public async Task ALineAnOrderIsFiledUnderCannotBeDeletedUntilTheOrderLetsGo()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await CreateCompletedOrderAsync(factory, client, admin, [(OrderFixtures.BasketballId, 5)]);
        var line = await AddLineAsync(client, manager);
        _ = await SaveAsync(client, admin, order.GetProperty("id").GetGuid(), PublicBody(order, consent: true, show: true, lineId: line));

        using var delete = await DeleteLineAsync(client, manager, line);

        delete.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(delete, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("product-lines.in-use");
    }

    [Fact]
    public async Task CancellingAShownOrderTakesItOffTheWebsiteRemovesItsEntryKeepsTheOkAndAReopenDoesNotPutItBack()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var order = await CreatePendingOrderAsync(factory, client, admin);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString()!;
        _ = await SaveAsync(client, admin, id, PublicBody(order, consent: true, show: true));
        (await GalleryEntryCountAsync(id)).ShouldBe(1);

        var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "cancelled");

        var settings = cancelled.GetProperty("publicWebsite");
        settings.GetProperty("shownOnWebsite").GetBoolean().ShouldBeFalse();
        settings.GetProperty("customerConsent").GetBoolean().ShouldBeTrue();
        OrderFixtures.IsNull(settings, "shownSinceUtc").ShouldBeTrue();
        (await GalleryEntryCountAsync(id)).ShouldBe(0);
        var actions = await OrderAuditActionsAsync(id, admin.UserId);
        actions.ShouldContain("order.taken-off-website");
        (await OrderAuditDetailAsync(id, "order.taken-off-website")).ShouldContain($"number={number}");

        var reopened = await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "pending");

        reopened.GetProperty("publicWebsite").GetProperty("shownOnWebsite").GetBoolean().ShouldBeFalse();
        reopened.GetProperty("publicWebsite").GetProperty("customerConsent").GetBoolean().ShouldBeTrue();
        (await GalleryEntryCountAsync(id)).ShouldBe(0);
    }

    [Fact]
    public async Task CancellingAnOrderThatWasNotShownWritesNoTakenOffEntry()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var order = await CreatePendingOrderAsync(factory, client, admin);
        var id = order.GetProperty("id").GetGuid();

        _ = await OrderFixtures.ChangeStatusAndReadAsync(client, admin.AccessToken, id, "cancelled");

        (await OrderAuditActionsAsync(id, admin.UserId)).ShouldNotContain("order.taken-off-website");
    }

    [Fact]
    public async Task DeletingAShownOrderTakesItOffTheWebsiteRemovesItsEntryKeepsTheOkAndARestoreDoesNotPutItBack()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await CreatePendingOrderAsync(factory, client, manager);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString()!;
        _ = await SaveAsync(client, manager, id, PublicBody(order, consent: true, show: true));
        (await GalleryEntryCountAsync(id)).ShouldBe(1);

        using var deleted = await OrderFixtures.DeleteAsync(client, manager.AccessToken, id);

        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var stored = await StoredSettingsAsync(id);
        stored.ShownSince.ShouldBeNull();
        stored.ConsentAt.ShouldNotBeNull();
        (await GalleryEntryCountAsync(id)).ShouldBe(0);
        var afterDelete = await OrderAuditActionsAsync(id, manager.UserId);
        afterDelete.ShouldContain("order.deleted");
        afterDelete.Count(action => action == "order.taken-off-website").ShouldBe(1);
        (await OrderAuditDetailAsync(id, "order.taken-off-website")).ShouldContain($"number={number}");

        using var restored = await OrderFixtures.RestoreAsync(client, manager.AccessToken, id);

        restored.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var detail = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        detail.GetProperty("publicWebsite").GetProperty("shownOnWebsite").GetBoolean().ShouldBeFalse();
        detail.GetProperty("publicWebsite").GetProperty("customerConsent").GetBoolean().ShouldBeTrue();
        (await GalleryEntryCountAsync(id)).ShouldBe(0);
        (await OrderAuditActionsAsync(id, manager.UserId)).Count(action => action == "order.taken-off-website").ShouldBe(1);

        var shownAgain = await SaveAsync(client, manager, id, PublicBody(detail, consent: true, show: true));

        shownAgain.GetProperty("publicWebsite").GetProperty("shownOnWebsite").GetBoolean().ShouldBeTrue();
        (await GalleryEntryCountAsync(id)).ShouldBe(1);
    }

    [Fact]
    public async Task DeletingAnOrderThatWasNotShownWritesNoTakenOffEntry()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await CreatePendingOrderAsync(factory, client, manager);
        var id = order.GetProperty("id").GetGuid();

        using var deleted = await OrderFixtures.DeleteAsync(client, manager.AccessToken, id);

        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var actions = await OrderAuditActionsAsync(id, manager.UserId);
        actions.ShouldContain("order.deleted");
        actions.ShouldNotContain("order.taken-off-website");
    }

    [Fact]
    public async Task RestoringAnOrderDeletedWhileStillShownTakesItOffRemovesTheLeftOverEntryAndKeepsTheOk()
    {
        await using var factory = await StartAsync();
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await CreatePendingOrderAsync(factory, client, manager);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString()!;
        _ = await SaveAsync(client, manager, id, PublicBody(order, consent: true, show: true));
        (await GalleryEntryCountAsync(id)).ShouldBe(1);
        await MarkDeletedInPlaceAsync(id, manager.UserId);
        (await StoredSettingsAsync(id)).ShownSince.ShouldNotBeNull();

        using var restored = await OrderFixtures.RestoreAsync(client, manager.AccessToken, id);

        restored.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var detail = await OrderFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        detail.GetProperty("publicWebsite").GetProperty("shownOnWebsite").GetBoolean().ShouldBeFalse();
        detail.GetProperty("publicWebsite").GetProperty("customerConsent").GetBoolean().ShouldBeTrue();
        (await StoredSettingsAsync(id)).ShownSince.ShouldBeNull();
        (await GalleryEntryCountAsync(id)).ShouldBe(0);
        var actions = await OrderAuditActionsAsync(id, manager.UserId);
        actions.ShouldContain("order.restored");
        actions.Count(action => action == "order.taken-off-website").ShouldBe(1);
        (await OrderAuditDetailAsync(id, "order.taken-off-website")).ShouldContain($"number={number}");

        var shownAgain = await SaveAsync(client, manager, id, PublicBody(detail, consent: true, show: true));

        shownAgain.GetProperty("publicWebsite").GetProperty("shownOnWebsite").GetBoolean().ShouldBeTrue();
        (await GalleryEntryCountAsync(id)).ShouldBe(1);
    }

    private static Guid LineId(string key) => ProductLineSeed.All.Single(entry => entry.Key == key).Id;

    private static async Task<JsonElement> SaveAsync(HttpClient client, StartedSession who, Guid orderId, object body)
    {
        using var response = await PutPublicAsync(client, who.AccessToken, orderId, body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    // A new hidden line that nothing else uses, added through the Manager route.
    private static async Task<Guid> AddLineAsync(HttpClient client, StartedSession manager)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, "/api/v1/product-lines", manager.AccessToken);
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("D"));
        request.Content = JsonContent.Create(new
        {
            title = "Sample Shorts",
            shortName = "Shorts",
            number = "7",
            cardText = "Light sample shorts.",
            description = "Sample shorts printed edge to edge.",
            fabricText = "Sample mesh",
            collarText = "No collar",
            cutText = "Standard fit",
            namesText = "Any font",
            logosText = "Team crest",
            isActive = false,
        });
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<HttpResponseMessage> DeleteLineAsync(HttpClient client, StartedSession manager, Guid lineId)
    {
        using var request = ApiRequests.Create(HttpMethod.Delete, $"/api/v1/product-lines/{lineId:D}", manager.AccessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

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

    private static async Task<JsonElement> CreatePendingOrderAsync(CspsApiFactory factory, HttpClient client, StartedSession who)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        return await OrderFixtures.CreateAsync(client, who.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
    }

    private async Task<List<string>> OrderAuditActionsAsync(Guid orderId, Guid actorId)
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            return await context.AuditLog.AsNoTracking()
                .Where(row => row.ActorUserId == actorId && row.TargetId == orderId.ToString("D") && row.TargetType == "Order")
                .Select(row => row.Action)
                .ToListAsync(TestContext.Current.CancellationToken);
        }
    }

    private async Task<string> OrderAuditDetailAsync(Guid orderId, string action)
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            return await context.AuditLog.AsNoTracking()
                .Where(row => row.TargetId == orderId.ToString("D") && row.TargetType == "Order" && row.Action == action)
                .Select(row => row.Detail!)
                .SingleAsync(TestContext.Current.CancellationToken);
        }
    }

    // Marks the row deleted without the handler, which leaves the shown date and the gallery entry as an older delete did.
    private async Task MarkDeletedInPlaceAsync(Guid orderId, Guid deletedBy)
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var deletedAt = TimeProvider.System.GetUtcNow();
            var changed = await context.Orders
                .Where(order => order.Id == orderId)
                .ExecuteUpdateAsync(
                    set => set.SetProperty(order => order.DeletedAtUtc, deletedAt).SetProperty(order => order.DeletedById, deletedBy),
                    TestContext.Current.CancellationToken);
            changed.ShouldBe(1);
        }
    }

    // Reads the stored columns past the soft-delete filter, so a deleted order can be checked.
    private async Task<(DateTimeOffset? ShownSince, DateTimeOffset? ConsentAt)> StoredSettingsAsync(Guid orderId)
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var row = await context.Orders.IgnoreQueryFilters().AsNoTracking()
                .Where(order => order.Id == orderId)
                .Select(order => new { order.ShownOnWebsiteSinceUtc, order.PublicConsentAtUtc })
                .SingleAsync(TestContext.Current.CancellationToken);
            return (row.ShownOnWebsiteSinceUtc, row.PublicConsentAtUtc);
        }
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

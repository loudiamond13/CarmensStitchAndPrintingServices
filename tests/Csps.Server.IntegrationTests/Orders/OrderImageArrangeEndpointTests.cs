using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Orders;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-04, D-11 to D-15, D-19: staff move photos, choose the cover and describe photos, each change guarded by the order's version.</summary>
public sealed class OrderImageArrangeEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task MovingTheSecondPhotoToTheFrontMakesItTheCoverAndAnswersTheWholeOrderWithANewVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString();
        var photos = PhotosByDescription(order);

        using var response = await PutPositionAsync(client, manager.AccessToken, id, photos["B"], 0, order.GetProperty("version").GetString());
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var answered = document.RootElement;
        DescriptionsInOrder(answered).ShouldBe(["B", "A", "C"]);
        answered.GetProperty("images").EnumerateArray().Select(image => image.GetProperty("position").GetInt32()).ShouldBe([0, 1, 2]);
        answered.GetProperty("version").GetString().ShouldNotBe(order.GetProperty("version").GetString());

        await using var context = database.CreateContext();
        var rows = await context.Set<OrderImage>().AsNoTracking().Where(row => row.OrderId == id).OrderBy(row => row.Position).ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(row => row.Id).ShouldBe([photos["B"], photos["A"], photos["C"]]);
        rows.Select(row => row.Slot).Order().ShouldBe([0, 1, 2]);
        var audit = await context.AuditLog.AsNoTracking().Where(entry => entry.TargetId == id.ToString("D") && entry.Action == "order-image.cover-changed").SingleAsync(TestContext.Current.CancellationToken);
        audit.Action.ShouldBe("order-image.cover-changed");
        audit.TargetType.ShouldBe("Order");
        audit.ActorUserId.ShouldBe(manager.UserId);
        audit.Detail.ShouldBe($"number={number};cover=2");

        var listed = (await OrderFixtures.ReadListAsync(client, manager.AccessToken, $"q={number}")).GetProperty("items").EnumerateArray().Single();
        listed.GetProperty("cover").GetProperty("width").GetInt32().ShouldBe(800);
    }

    [Fact]
    public async Task TheOldVersionAnswers409StaleAndThePositionsStay()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var photos = PhotosByDescription(order);
        var oldVersion = order.GetProperty("version").GetString();
        using (var first = await PutPositionAsync(client, manager.AccessToken, id, photos["B"], 0, oldVersion))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using var stale = await PutPositionAsync(client, manager.AccessToken, id, photos["C"], 0, oldVersion);

        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(stale, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        await using var context = database.CreateContext();
        var rows = await context.Set<OrderImage>().AsNoTracking().Where(row => row.OrderId == id).OrderBy(row => row.Position).ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(row => row.Id).ShouldBe([photos["B"], photos["A"], photos["C"]]);
    }

    [Fact]
    public async Task MovingTheCoverAwayFromTheFrontWritesMovedAndCoverChangedNamingTheNewCover()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var order = await OrderWithThreePhotosAsync(factory, client, admin.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString();
        var photos = PhotosByDescription(order);

        using var response = await PutPositionAsync(client, admin.AccessToken, id, photos["A"], 2, order.GetProperty("version").GetString());
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        DescriptionsInOrder(document.RootElement).ShouldBe(["B", "C", "A"]);
        var entries = await ImageAuditAsync(id);
        entries.ShouldBe([("order-image.moved", $"number={number};from=1;to=3"), ("order-image.cover-changed", $"number={number};cover=2")], ignoreOrder: true);
    }

    [Fact]
    public async Task MovingAMiddlePhotoLeavesTheCoverAloneAndWritesOnlyMoved()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString();

        using var response = await PutPositionAsync(client, manager.AccessToken, id, PhotosByDescription(order)["B"], 2, order.GetProperty("version").GetString());

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ImageAuditAsync(id)).ShouldBe([("order-image.moved", $"number={number};from=2;to=3")]);
    }

    [Theory]
    [InlineData(3)]
    [InlineData(5)]
    [InlineData(-1)]
    public async Task APlaceAtOrAboveThePhotoCountOrBelowZeroAnswers400OnThePositionField(int place)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();

        using var response = await PutPositionAsync(client, manager.AccessToken, id, PhotosByDescription(order)["A"], place, order.GetProperty("version").GetString());

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        OrderFixtures.FieldErrors(problem, "position").ShouldBe([OrderImageRules.PositionOutOfRangeMessage]);
        (await ImageAuditAsync(id)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AMissingVersionOrPositionAnswers400OnThoseFields()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();

        using var response = await PutPositionAsync(client, manager.AccessToken, id, PhotosByDescription(order)["A"], null, null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.ErrorFields(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).Order().ShouldBe(["position", "version"]);
    }

    [Fact]
    public async Task MovingAPhotoToThePlaceItHasAnswers200WithTheSameVersionAndWritesNoAuditRow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var photos = PhotosByDescription(order);
        var version = order.GetProperty("version").GetString();
        var auditBefore = (await ImageAuditAsync(id)).Count;

        using var middle = await PutPositionAsync(client, manager.AccessToken, id, photos["B"], 1, version);
        using var cover = await PutPositionAsync(client, manager.AccessToken, id, photos["A"], 0, version);

        middle.StatusCode.ShouldBe(HttpStatusCode.OK);
        cover.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var middleDocument = JsonDocument.Parse(await middle.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        using var coverDocument = JsonDocument.Parse(await cover.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        middleDocument.RootElement.GetProperty("version").GetString().ShouldBe(version);
        coverDocument.RootElement.GetProperty("version").GetString().ShouldBe(version);
        DescriptionsInOrder(coverDocument.RootElement).ShouldBe(["A", "B", "C"]);
        (await ImageAuditAsync(id)).Count.ShouldBe(auditBefore);
    }

    [Fact]
    public async Task APhotoOfAnotherOrderOrAnUnknownPhotoAnswers404AndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var other = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var version = order.GetProperty("version").GetString();

        using var foreign = await PutPositionAsync(client, manager.AccessToken, id, PhotosByDescription(other)["B"], 0, version);
        using var unknown = await PutPositionAsync(client, manager.AccessToken, id, Guid.NewGuid(), 0, version);

        foreach (var response in new[] { foreign, unknown })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe("orders.image-not-found");
            problem.GetProperty("detail").GetString().ShouldBe("This photo is no longer on this order.");
        }

        (await ImageAuditAsync(id)).ShouldBeEmpty();
        (await ImageAuditAsync(other.GetProperty("id").GetGuid())).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnknownOrderAnswers404OrdersNotFound()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);

        using var response = await PutPositionAsync(client, manager.AccessToken, Guid.NewGuid(), PhotosByDescription(order)["A"], 0, order.GetProperty("version").GetString());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
    }

    [Fact]
    public async Task ACancelledOrderAnswers422LockedOnAMoveAndTheOrderOfThePhotosStays()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var cancelled = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "cancelled");

        using var response = await PutPositionAsync(client, manager.AccessToken, id, PhotosByDescription(order)["C"], 0, cancelled.GetProperty("version").GetString());

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.locked");
        await using var context = database.CreateContext();
        var rows = await context.Set<OrderImage>().AsNoTracking().Where(row => row.OrderId == id).OrderBy(row => row.Position).ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(row => row.Description).ShouldBe(["A", "B", "C"]);
    }

    [Fact]
    public async Task ACompletedOrderAnswers422LockedOnAMove()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var paid = await OrderFixtures.Ord0148PaidInFullAsync(client, admin, manager, today);
        var id = paid.GetProperty("id").GetGuid();
        var withPhotos = await AddThreePhotosAsync(client, manager.AccessToken, id);
        var completed = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "completed");

        using var response = await PutPositionAsync(client, manager.AccessToken, id, PhotosByDescription(withPhotos)["B"], 0, completed.GetProperty("version").GetString());

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.locked");
    }

    [Fact]
    public async Task TwoMovesSentTogetherWithOneVersionGiveOneOkAndOneStaleAndLeaveWholePlaces()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var photos = PhotosByDescription(order);
        var version = order.GetProperty("version").GetString();

        var (first, second) = await ConcurrentRequests.SendTogetherAsync(
            () => PutPositionAsync(client, manager.AccessToken, id, photos["B"], 0, version),
            () => PutPositionAsync(client, manager.AccessToken, id, photos["C"], 0, version));
        using (first)
        using (second)
        {
            new[] { first.StatusCode, second.StatusCode }.Order().ShouldBe([HttpStatusCode.OK, HttpStatusCode.Conflict]);
        }

        await using var context = database.CreateContext();
        var rows = await context.Set<OrderImage>().AsNoTracking().Where(row => row.OrderId == id).ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(row => row.Position).Order().ShouldBe([0, 1, 2]);
        rows.Select(row => row.Slot).Order().ShouldBe([0, 1, 2]);
        (await ImageAuditAsync(id)).Count(entry => entry.Action == "order-image.moved").ShouldBe(1);
    }

    [Fact]
    public async Task ADescriptionIsTrimmedSavedAndAnsweredWithTheWholeOrderAndAuditedWithOldAndNewText()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString();
        var photos = PhotosByDescription(order);

        using var response = await PutDescriptionAsync(client, manager.AccessToken, id, photos["B"], "  Front mockup  ", order.GetProperty("version").GetString());
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        DescriptionsInOrder(document.RootElement).ShouldBe(["A", "Front mockup", "C"]);
        document.RootElement.GetProperty("version").GetString().ShouldNotBe(order.GetProperty("version").GetString());
        var entry = (await ImageAuditAsync(id)).ShouldHaveSingleItem();
        entry.Action.ShouldBe("order-image.description-changed");
        entry.Detail.ShouldBe($"number={number};position=2;description=B>Front mockup");
    }

    [Theory]
    [InlineData("")]
    [InlineData("    ")]
    [InlineData(null)]
    public async Task AnEmptyDescriptionIsStoredAsNoneSoTheDefaultFollowsThePlace(string? description)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString();
        var photos = PhotosByDescription(order);

        using var response = await PutDescriptionAsync(client, manager.AccessToken, id, photos["C"], description, order.GetProperty("version").GetString());

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var third = document.RootElement.GetProperty("images").EnumerateArray().Single(image => image.GetProperty("id").GetGuid() == photos["C"]);
        third.GetProperty("description").ValueKind.ShouldBe(JsonValueKind.Null);
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().AsNoTracking().SingleAsync(row => row.Id == photos["C"], TestContext.Current.CancellationToken)).Description.ShouldBeNull();
        (await ImageAuditAsync(id)).ShouldHaveSingleItem().Detail.ShouldBe($"number={number};position=3;description=C>Order {number} photo 3");
    }

    [Fact]
    public async Task TheDefaultTextOfThePhotosCurrentPlaceIsStoredAsNone()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString();
        var photos = PhotosByDescription(order);

        using var response = await PutDescriptionAsync(client, manager.AccessToken, id, photos["B"], $"Order {number} photo 2", order.GetProperty("version").GetString());

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().AsNoTracking().SingleAsync(row => row.Id == photos["B"], TestContext.Current.CancellationToken)).Description.ShouldBeNull();
    }

    [Fact]
    public async Task ADescriptionOf201CharactersAnswers400WithThePlainMessage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var photos = PhotosByDescription(order);
        var version = order.GetProperty("version").GetString();

        using var fits = await PutDescriptionAsync(client, manager.AccessToken, id, photos["A"], new string('a', 200), version);
        using var tooLong = await PutDescriptionAsync(client, manager.AccessToken, id, photos["B"], new string('b', 201), version);

        tooLong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderFixtures.FieldErrors(await ProblemJson.ReadAsync(tooLong, TestContext.Current.CancellationToken), "description").ShouldBe(["Keep the description to 200 characters or fewer."]);
        fits.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ASameDescriptionAnswers200WithTheSameVersionAndWritesNoAuditRow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var version = order.GetProperty("version").GetString();

        using var response = await PutDescriptionAsync(client, manager.AccessToken, id, PhotosByDescription(order)["A"], " A ", version);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("version").GetString().ShouldBe(version);
        (await ImageAuditAsync(id)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AStaleVersionOnADescriptionAnswers409AndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var photos = PhotosByDescription(order);
        var oldVersion = order.GetProperty("version").GetString();
        using (var moved = await PutPositionAsync(client, manager.AccessToken, id, photos["B"], 0, oldVersion))
        {
            moved.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using var stale = await PutDescriptionAsync(client, manager.AccessToken, id, photos["A"], "Late edit", oldVersion);

        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(stale, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().AsNoTracking().SingleAsync(row => row.Id == photos["A"], TestContext.Current.CancellationToken)).Description.ShouldBe("A");
    }

    [Fact]
    public async Task ADeletedOrAnotherOrdersPhotoCannotBeDescribedAndAnswers404WithThePlainMessage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var order = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var other = await OrderWithThreePhotosAsync(factory, client, manager.AccessToken);
        var id = order.GetProperty("id").GetGuid();
        var version = order.GetProperty("version").GetString();

        using var foreign = await PutDescriptionAsync(client, manager.AccessToken, id, PhotosByDescription(other)["A"], "Mine now", version);
        using var gone = await PutDescriptionAsync(client, manager.AccessToken, id, Guid.NewGuid(), "Gone", version);

        foreach (var response in new[] { foreign, gone })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe("orders.image-not-found");
            problem.GetProperty("detail").GetString().ShouldBe("This photo is no longer on this order.");
        }

        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().AsNoTracking().SingleAsync(row => row.Id == PhotosByDescription(other)["A"], TestContext.Current.CancellationToken)).Description.ShouldBe("A");
    }

    [Fact]
    public async Task ACompletedOrderAnswers422LockedOnADescription()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var paid = await OrderFixtures.Ord0148PaidInFullAsync(client, admin, manager, today);
        var id = paid.GetProperty("id").GetGuid();
        var withPhotos = await AddThreePhotosAsync(client, manager.AccessToken, id);
        var completed = await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "completed");

        using var response = await PutDescriptionAsync(client, manager.AccessToken, id, PhotosByDescription(withPhotos)["A"], "Too late", completed.GetProperty("version").GetString());

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.locked");
    }

    private async Task<List<(string Action, string? Detail)>> ImageAuditAsync(Guid orderId)
    {
        await using var context = database.CreateContext();
        var rows = await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == orderId.ToString("D") && entry.Action.StartsWith("order-image.") && entry.Action != "order-image.added")
            .Select(entry => new { entry.Action, entry.Detail })
            .ToListAsync(TestContext.Current.CancellationToken);
        return [.. rows.Select(row => (row.Action, row.Detail))];
    }

    private static string[] DescriptionsInOrder(JsonElement order) =>
        [.. order.GetProperty("images").EnumerateArray().Select(image => image.GetProperty("description").GetString()!)];

    private static Dictionary<string, Guid> PhotosByDescription(JsonElement order) =>
        order.GetProperty("images").EnumerateArray().ToDictionary(image => image.GetProperty("description").GetString()!, image => image.GetProperty("id").GetGuid());

    private static async Task<JsonElement> OrderWithThreePhotosAsync(CspsApiFactory factory, HttpClient client, string accessToken)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, accessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        return await AddThreePhotosAsync(client, accessToken, created.GetProperty("id").GetGuid());
    }

    private static async Task<JsonElement> AddThreePhotosAsync(HttpClient client, string accessToken, Guid id)
    {
        JsonElement latest = default;
        foreach (var (name, width, height) in new[] { ("A", 640, 480), ("B", 800, 600), ("C", 320, 240) })
        {
            using var response = await UploadAsync(client, accessToken, id, SyntheticImages.Jpeg(width, height), name);
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
            using var document = JsonDocument.Parse(text);
            latest = document.RootElement.Clone();
        }

        return latest;
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, string accessToken, Guid orderId, byte[] file, string description)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        var form = new MultipartFormDataContent();
        var part = new ByteArrayContent(file);
        part.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
        form.Add(part, "file", "photo.jpg");
        form.Add(new StringContent(description), "description");
        request.Content = form;
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> PutDescriptionAsync(HttpClient client, string? accessToken, Guid orderId, Guid imageId, string? description, string? version)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, $"/api/v1/orders/{orderId:D}/images/{imageId:D}", accessToken);
        request.Content = JsonContent.Create(new Dictionary<string, object?> { ["description"] = description, ["version"] = version });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> PutPositionAsync(HttpClient client, string? accessToken, Guid orderId, Guid imageId, int? position, string? version)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, $"/api/v1/orders/{orderId:D}/images/{imageId:D}/position", accessToken);
        request.Content = JsonContent.Create(new Dictionary<string, object?> { ["position"] = position, ["version"] = version });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}

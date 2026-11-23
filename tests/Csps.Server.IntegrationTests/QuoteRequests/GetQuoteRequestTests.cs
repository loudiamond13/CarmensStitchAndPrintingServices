using System.Net;
using System.Text.Json;
using Csps.Application.Common;
using Csps.Application.Security;
using Csps.Domain.QuoteRequests;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>INQ-05, D-13, D-36: staff of either role open one quote request and see every field, its private photo addresses and its history.</summary>
public sealed class GetQuoteRequestTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string ImageRoute = "/api/testing/images/";
    private static readonly DateTimeOffset Received = new(2026, 11, 21, 7, 42, 0, TimeSpan.Zero);

    [Fact]
    public async Task StaffSeeEveryFieldTheStoredPhotosTheMissingNamesAndTheReceivedRow()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        await ProductLineSeeding.RestoreSixAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed(
            "Juan Dela Cruz",
            QuoteRequestStatus.New,
            Received,
            Team: "Brgy. San Roque Ballers",
            Phone: "0917 123 4567",
            Email: "juan@example.test",
            Choice: QuoteProductChoice.Line,
            LineId: Guid.Parse("3a48a1d6-c812-4481-a6be-d7d7412484a0"),
            Title: "Basketball Jerseys",
            Quantity: QuoteQuantityRange.TwentyOneToFifty,
            Message: "Twelve jerseys, numbers 1 to 12.\nNavy and gold.",
            PhotoNames: ["front.jpg", "back.png", "sketch.heic"],
            StoredSlots: [0, 1]));

        var body = await rig.ReadAsync(id);

        body.GetProperty("id").GetGuid().ShouldBe(id);
        body.GetProperty("receivedAtUtc").GetDateTimeOffset().ShouldBe(Received);
        body.GetProperty("customerName").GetString().ShouldBe("Juan Dela Cruz");
        body.GetProperty("teamName").GetString().ShouldBe("Brgy. San Roque Ballers");
        body.GetProperty("contactNumber").GetString().ShouldBe("0917 123 4567");
        body.GetProperty("email").GetString().ShouldBe("juan@example.test");
        body.GetProperty("product").GetProperty("choice").GetString().ShouldBe("line");
        body.GetProperty("product").GetProperty("title").GetString().ShouldBe("Basketball Jerseys");
        body.GetProperty("quantity").GetString().ShouldBe("21-50");
        body.GetProperty("message").GetString().ShouldBe("Twelve jerseys, numbers 1 to 12.\nNavy and gold.");
        body.GetProperty("status").GetString().ShouldBe("new");
        body.GetProperty("statusChangedAtUtc").GetDateTimeOffset().ShouldBe(Received);
        body.GetProperty("photoCount").GetInt32().ShouldBe(3);
        body.GetProperty("photosRemovedAtUtc").ValueKind.ShouldBe(JsonValueKind.Null);

        var photos = body.GetProperty("photos").EnumerateArray().ToList();
        photos.Count.ShouldBe(2);
        AssertPhoto(photos[0], 0, "front.jpg", QuoteRequestStaffRig.PublicIdOf(id, 0));
        AssertPhoto(photos[1], 1, "back.png", QuoteRequestStaffRig.PublicIdOf(id, 1));
        body.GetProperty("missingPhotos").EnumerateArray().Select(name => name.GetString()).ShouldBe(["sketch.heic"]);

        var history = body.GetProperty("history").EnumerateArray().ToList();
        history.Count.ShouldBe(1);
        history[0].GetProperty("from").ValueKind.ShouldBe(JsonValueKind.Null);
        history[0].GetProperty("to").GetString().ShouldBe("new");
        history[0].GetProperty("changedBy").ValueKind.ShouldBe(JsonValueKind.Null);
        history[0].GetProperty("changedAt").GetDateTimeOffset().ShouldBe(Received);

        body.GetProperty("recordedBy").ValueKind.ShouldBe(JsonValueKind.Null);
        body.GetProperty("recordedAt").GetDateTimeOffset().ShouldBe(Received);
        body.GetProperty("lastChangedBy").ValueKind.ShouldBe(JsonValueKind.Null);
        body.GetProperty("lastChangedAt").ValueKind.ShouldBe(JsonValueKind.Null);

        await using var context = database.CreateContext();
        var stored = await context.QuoteRequests.AsNoTracking()
            .Where(request => request.Id == id)
            .Select(request => request.RowVersion)
            .SingleAsync(TestContext.Current.CancellationToken);
        body.GetProperty("version").GetString().ShouldBe(RowVersions.ToText(stored));
    }

    [Fact]
    public async Task ARequestWithNoPhotosHasEmptyListsAndEmptyFieldsAreNull()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Maria Santos", QuoteRequestStatus.Contacted, Received, Phone: "0918 765 4321"));

        var body = await rig.ReadAsync(id);

        body.GetProperty("teamName").ValueKind.ShouldBe(JsonValueKind.Null);
        body.GetProperty("email").ValueKind.ShouldBe(JsonValueKind.Null);
        body.GetProperty("product").ValueKind.ShouldBe(JsonValueKind.Null);
        body.GetProperty("quantity").ValueKind.ShouldBe(JsonValueKind.Null);
        body.GetProperty("message").ValueKind.ShouldBe(JsonValueKind.Null);
        body.GetProperty("status").GetString().ShouldBe("contacted");
        body.GetProperty("photoCount").GetInt32().ShouldBe(0);
        body.GetProperty("photos").GetArrayLength().ShouldBe(0);
        body.GetProperty("missingPhotos").GetArrayLength().ShouldBe(0);
    }

    [Fact]
    public async Task ARandomIdIs404WithTheNotFoundCode()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);

        using var response = await rig.GetAsync(rig.Admin.AccessToken, $"{QuoteRequestStaffRig.Route}/{Guid.NewGuid():D}");
        var problem = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.NotFound);

        problem.GetProperty("code").GetString().ShouldBe("quote-requests.not-found");
    }

    [Fact]
    public async Task AnAnonymousCallerGets401AndAManagerReadsTheRequest()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);

        using var anonymous = await rig.GetAsync(null, $"{QuoteRequestStaffRig.Route}/{id:D}");
        var body = await rig.ReadAsync(id, manager.AccessToken);

        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        body.GetProperty("id").GetGuid().ShouldBe(id);
    }

    private static void AssertPhoto(JsonElement photo, int slot, string fileName, string publicId)
    {
        var last = publicId[(publicId.LastIndexOf('/') + 1)..];
        string Address(string size) => $"{ImageRoute}{last}?size={size}";

        photo.GetProperty("slot").GetInt32().ShouldBe(slot);
        photo.GetProperty("fileName").GetString().ShouldBe(fileName);
        photo.GetProperty("width").GetInt32().ShouldBe(4000);
        photo.GetProperty("height").GetInt32().ShouldBe(3000);
        photo.GetProperty("thumb").GetProperty("src").GetString().ShouldBe(Address("csps_sq_88"));
        photo.GetProperty("thumb").GetProperty("srcSet").GetString().ShouldBe($"{Address("csps_sq_88")} 1x, {Address("csps_sq_176")} 2x");
        photo.GetProperty("viewer").GetProperty("src").GetString().ShouldBe(Address("csps_view_960"));
        photo.GetProperty("fullSize").GetString().ShouldBe(Address("csps_full_2000"));
        photo.EnumerateObject().Select(property => property.Name).ShouldNotContain("publicId");
    }
}

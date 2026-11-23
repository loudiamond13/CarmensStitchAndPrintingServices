using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.QuoteRequests;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>INQ-05, D-13, D-14, D-18: staff list the quote requests by status group, newest first, with search, paging and server-made counts.</summary>
public sealed class ListQuoteRequestsTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/quote-requests";
    private static readonly DateTimeOffset Base = new(2026, 11, 20, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task OpenRequestsAreListedNewestFirst()
    {
        await using var rig = await Rig.StartAsync(database);
        var oldest = await rig.SeedAsync(new Seed("New Nina", QuoteRequestStatus.New, Base));
        var contacted = await rig.SeedAsync(new Seed("Contacted Cora", QuoteRequestStatus.Contacted, Base.AddHours(1)));
        var quoted = await rig.SeedAsync(new Seed("Quoted Quin", QuoteRequestStatus.Quoted, Base.AddHours(2)));
        await rig.SeedAsync(new Seed("Converted Carl", QuoteRequestStatus.Converted, Base.AddHours(3)));
        await rig.SeedAsync(new Seed("Closed Clea", QuoteRequestStatus.Closed, Base.AddHours(4)));
        await rig.SeedAsync(new Seed("Spam Sid", QuoteRequestStatus.Spam, Base.AddHours(5)));

        var page = await rig.ReadAsync();

        page.GetProperty("total").GetInt32().ShouldBe(3);
        page.GetProperty("page").GetInt32().ShouldBe(1);
        page.GetProperty("size").GetInt32().ShouldBe(20);
        Ids(page).ShouldBe([quoted, contacted, oldest]);
        Statuses(page).ShouldBe(["quoted", "contacted", "new"]);
    }

    [Fact]
    public async Task TwoRequestsReceivedAtTheSameTimeComeByIdDescending()
    {
        await using var rig = await Rig.StartAsync(database);
        var first = await rig.SeedAsync(new Seed("Twin One", QuoteRequestStatus.New, Base, Id: Guid.Parse("018f0000-0000-7000-8000-000000000001")));
        var second = await rig.SeedAsync(new Seed("Twin Two", QuoteRequestStatus.New, Base, Id: Guid.Parse("018f0000-0000-7000-8000-000000000002")));
        await using var context = database.CreateContext();
        var ids = new[] { first, second };
        var byIdDescending = await context.QuoteRequests.AsNoTracking()
            .Where(request => ids.Contains(request.Id))
            .OrderByDescending(request => request.Id)
            .Select(request => request.Id)
            .ToListAsync(TestContext.Current.CancellationToken);

        var page = await rig.ReadAsync();

        Ids(page).ShouldBe(byIdDescending);
    }

    [Fact]
    public async Task EachRowCarriesTheFieldsStaffNeedAndNoMoreThanThat()
    {
        await using var rig = await Rig.StartAsync(database);
        await ProductLineSeeding.RestoreSixAsync(database);
        var full = await rig.SeedAsync(new Seed(
            "Juan Dela Cruz",
            QuoteRequestStatus.New,
            Base,
            Team: "Brgy. San Roque Ballers",
            Phone: "0917 123 4567",
            Choice: QuoteProductChoice.Line,
            LineId: Guid.Parse("3a48a1d6-c812-4481-a6be-d7d7412484a0"),
            Title: "Basketball Jerseys",
            Quantity: QuoteQuantityRange.TwentyOneToFifty,
            Declared: 3,
            Stored: 2));
        var bare = await rig.SeedAsync(new Seed("Maria Santos", QuoteRequestStatus.Contacted, Base.AddMinutes(-5), Phone: "0918 765 4321", Choice: QuoteProductChoice.Custom));

        var page = await rig.ReadAsync();

        var rows = page.GetProperty("items").EnumerateArray().ToDictionary(item => item.GetProperty("id").GetGuid());
        var row = rows[full];
        row.GetProperty("receivedAtUtc").GetDateTimeOffset().ShouldBe(Base);
        row.GetProperty("customerName").GetString().ShouldBe("Juan Dela Cruz");
        row.GetProperty("teamName").GetString().ShouldBe("Brgy. San Roque Ballers");
        row.GetProperty("contactNumber").GetString().ShouldBe("0917 123 4567");
        row.GetProperty("product").GetProperty("choice").GetString().ShouldBe("line");
        row.GetProperty("product").GetProperty("title").GetString().ShouldBe("Basketball Jerseys");
        row.GetProperty("quantity").GetString().ShouldBe("21-50");
        row.GetProperty("photoCount").GetInt32().ShouldBe(3);
        row.GetProperty("storedPhotoCount").GetInt32().ShouldBe(2);
        row.GetProperty("photosRemoved").GetBoolean().ShouldBeFalse();
        row.GetProperty("status").GetString().ShouldBe("new");
        row.EnumerateObject().Select(property => property.Name).ShouldNotContain("email");
        row.EnumerateObject().Select(property => property.Name).ShouldNotContain("message");

        var other = rows[bare];
        other.GetProperty("teamName").ValueKind.ShouldBe(JsonValueKind.Null);
        other.GetProperty("contactNumber").GetString().ShouldBe("0918 765 4321");
        other.GetProperty("product").GetProperty("choice").GetString().ShouldBe("custom");
        other.GetProperty("product").GetProperty("title").ValueKind.ShouldBe(JsonValueKind.Null);
        other.GetProperty("quantity").ValueKind.ShouldBe(JsonValueKind.Null);
        other.GetProperty("photoCount").GetInt32().ShouldBe(0);
        other.GetProperty("storedPhotoCount").GetInt32().ShouldBe(0);
        other.GetProperty("status").GetString().ShouldBe("contacted");
    }

    [Fact]
    public async Task AnAnonymousCallerGets401AndAManagerReadsTheSameList()
    {
        await using var rig = await Rig.StartAsync(database);
        var id = await rig.SeedAsync(new Seed("Juan Dela Cruz", QuoteRequestStatus.New, Base));
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);

        using var anonymous = await rig.GetAsync(null, Route);
        var page = await rig.ReadAsync(token: manager.AccessToken);

        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        Ids(page).ShouldBe([id]);
    }

    private static List<Guid> Ids(JsonElement page) => [.. page.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("id").GetGuid())];

    private static List<string?> Statuses(JsonElement page) => [.. page.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("status").GetString())];

    private sealed record Seed(
        string Name,
        QuoteRequestStatus Status,
        DateTimeOffset ReceivedAt,
        string? Team = null,
        string Phone = "0917 123 4567",
        QuoteProductChoice? Choice = null,
        Guid? LineId = null,
        string? Title = null,
        QuoteQuantityRange? Quantity = null,
        int Declared = 0,
        int Stored = 0,
        Guid? Id = null);

    private sealed class Rig : IAsyncDisposable
    {
        private readonly CspsDatabase _database;

        private Rig(CspsApiFactory factory, CspsDatabase database, StartedSession admin)
        {
            Factory = factory;
            _database = database;
            Client = factory.CreateClient();
            Admin = admin;
        }

        public CspsApiFactory Factory { get; }

        public HttpClient Client { get; }

        public StartedSession Admin { get; }

        public static async Task<Rig> StartAsync(CspsDatabase database)
        {
            await database.ResetAsync();
            var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
            try
            {
                var admin = await TestSessions.StartAsync(factory, Roles.Admin);
                return new Rig(factory, database, admin);
            }
            catch
            {
                await factory.DisposeAsync();
                throw;
            }
        }

        public async Task<HttpResponseMessage> GetAsync(string? token, string path)
        {
            using var request = ApiRequests.Get(path, token);
            return await Client.SendAsync(request, TestContext.Current.CancellationToken);
        }

        // Lists with the query string given, expects a 200 and returns the body.
        public async Task<JsonElement> ReadAsync(string? query = null, string? token = null)
        {
            using var response = await GetAsync(token ?? Admin.AccessToken, string.IsNullOrEmpty(query) ? Route : $"{Route}?{query}");
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
            using var document = JsonDocument.Parse(text);
            return document.RootElement.Clone();
        }

        // Saves the request, then sets the received time and the status straight in the table: the stamp on save writes the real clock.
        public async Task<Guid> SeedAsync(Seed seed)
        {
            var id = seed.Id ?? Guid.CreateVersion7(seed.ReceivedAt);
            var input = new QuoteRequestInput(seed.Name, seed.Team, seed.Phone, null, seed.Choice, seed.LineId, seed.Title, seed.Quantity);
            var request = QuoteRequest.Receive(id, input, seed.ReceivedAt).Value;
            if (seed.Declared > 0)
            {
                request.DeclarePhotos(
                    [.. Enumerable.Range(0, seed.Declared).Select(slot => $"photo-{slot}.jpg")],
                    new byte[QuoteRequestRules.UploadKeyHashLength],
                    seed.ReceivedAt.AddHours(2)).IsSuccess.ShouldBeTrue();
            }

            await using var context = _database.CreateContext();
            context.QuoteRequests.Add(request);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            await context.QuoteRequests
                .Where(row => row.Id == id)
                .ExecuteUpdateAsync(
                    set => set
                        .SetProperty(row => row.CreatedAtUtc, seed.ReceivedAt)
                        .SetProperty(row => row.Status, seed.Status),
                    TestContext.Current.CancellationToken);
            for (var slot = 0; slot < seed.Stored; slot++)
            {
                var slotNumber = slot;
                await context.QuoteRequestPhotos
                    .Where(photo => photo.QuoteRequestId == id && photo.Slot == slotNumber)
                    .ExecuteUpdateAsync(set => set.SetProperty(photo => photo.PublicId, $"quote-{id:N}-{slotNumber}"), TestContext.Current.CancellationToken);
            }

            return id;
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await Factory.DisposeAsync();
        }
    }
}

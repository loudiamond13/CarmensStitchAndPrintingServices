using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// CONT-04, SEC-07, SEC-08, AUDIT-01, T-11-31: a Manager adds, edits and deletes closures through <c>/api/v1/shop-closures</c>. A closure
/// that overlaps another is refused under the site-content lock, so two Managers cannot add overlapping closures at once. A stale edit is
/// a 409, a second delete is a 404, the server stamps the rows, and every change writes one audit entry that never holds the note text.
/// The host clock is pinned to Monday 2 Nov 2026, earlier than the real clock, so a session started on the real clock stays valid.
/// </summary>
public sealed class ShopClosureEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/shop-closures";

    private static readonly DateTimeOffset PinnedNow = new(2026, 11, 2, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AddingDecemberTwentyFiveWhenDecemberTwentyFourToTwentySixExistsIs400NamingTheDayUnderFirstDay()
    {
        await using var rig = await Rig.StartAsync(database);
        using var existing = await rig.PostAsync(rig.Manager, "2026-12-24", "2026-12-26", "Christmas");
        existing.StatusCode.ShouldBe(HttpStatusCode.Created, await existing.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        using var response = await rig.PostAsync(rig.Manager, "2026-12-25", null, null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("site-content.invalid-request");
        problem.GetProperty("errors").GetProperty("firstDay")[0].GetString().ShouldBe("There's already a closure on Dec 25, 2026.");
        (await rig.ListAsync(rig.Manager)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task AClosureOverlappingFromTheLeftNamesTheFirstSharedDay()
    {
        await using var rig = await Rig.StartAsync(database);
        using var existing = await rig.PostAsync(rig.Manager, "2026-12-24", "2026-12-26", null);
        existing.StatusCode.ShouldBe(HttpStatusCode.Created);

        using var response = await rig.PostAsync(rig.Manager, "2026-12-20", "2026-12-25", null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("firstDay")[0].GetString().ShouldBe("There's already a closure on Dec 24, 2026.");
    }

    [Fact]
    public async Task ClosuresThatOnlyTouchAreBothStored()
    {
        await using var rig = await Rig.StartAsync(database);
        using var first = await rig.PostAsync(rig.Manager, "2026-12-24", "2026-12-25", null);
        using var second = await rig.PostAsync(rig.Manager, "2026-12-26", "2026-12-27", null);

        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.StatusCode.ShouldBe(HttpStatusCode.Created);
        (await rig.ListAsync(rig.Manager)).Count.ShouldBe(2);
    }

    [Fact]
    public async Task TwoManagersAddingOverlappingClosuresAtTheSameMomentEndWithOneStoredClosureAndOneRefusal()
    {
        await using var rig = await Rig.StartAsync(database);
        var other = await TestSessions.StartAsync(rig.Base, Roles.Manager);

        var responses = await Task.WhenAll(
            rig.PostAsync(rig.Manager, "2026-12-24", "2026-12-26", "One"),
            rig.PostAsync(other, "2026-12-25", "2026-12-27", "Two"));
        try
        {
            responses.Select(response => response.StatusCode).Order().ShouldBe([HttpStatusCode.Created, HttpStatusCode.BadRequest]);
            (await rig.ListAsync(rig.Manager)).Count.ShouldBe(1);
        }
        finally
        {
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }
    }

    [Fact]
    public async Task EditingAClosureKeepingItsOwnDaysIsNotAnOverlapWithItself()
    {
        await using var rig = await Rig.StartAsync(database);
        var closure = await rig.AddAsync("2026-12-24", "2026-12-26", "Christmas");

        using var response = await rig.PutAsync(rig.Manager, closure.Id, "2026-12-24", "2026-12-27", "Christmas", closure.Version);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        using var saved = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        saved.RootElement.GetProperty("lastDay").GetString().ShouldBe("2026-12-27");
        saved.RootElement.GetProperty("version").GetString().ShouldNotBe(closure.Version);
    }

    [Fact]
    public async Task EditingAClosureIntoAnotherOnesDaysIs400AndChangesNothing()
    {
        await using var rig = await Rig.StartAsync(database);
        var christmas = await rig.AddAsync("2026-12-24", "2026-12-26", null);
        var newYear = await rig.AddAsync("2026-12-30", "2027-01-01", null);

        using var response = await rig.PutAsync(rig.Manager, newYear.Id, "2026-12-26", "2027-01-01", null, newYear.Version);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("firstDay")[0].GetString().ShouldBe("There's already a closure on Dec 26, 2026.");
        var stored = (await rig.ListAsync(rig.Manager)).Single(item => item.Id == newYear.Id);
        stored.FirstDay.ShouldBe("2026-12-30");
        christmas.Id.ShouldNotBe(Guid.Empty);
    }

    [Fact]
    public async Task EditingWithAStaleVersionIs409EditStaleAndChangesNothing()
    {
        await using var rig = await Rig.StartAsync(database);
        var closure = await rig.AddAsync("2026-12-24", null, "Christmas");
        var other = await TestSessions.StartAsync(rig.Base, Roles.Manager);
        using var winner = await rig.PutAsync(other, closure.Id, "2026-12-24", null, "Christmas Eve", closure.Version);
        winner.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var loser = await rig.PutAsync(rig.Manager, closure.Id, "2026-12-25", null, "Christmas Day", closure.Version);

        loser.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        var stored = (await rig.ListAsync(rig.Manager)).Single();
        stored.FirstDay.ShouldBe("2026-12-24");
        stored.Note.ShouldBe("Christmas Eve");
    }

    [Fact]
    public async Task EditingAnUnknownClosureIs404()
    {
        await using var rig = await Rig.StartAsync(database);

        using var response = await rig.PutAsync(rig.Manager, Guid.NewGuid(), "2026-12-24", null, null, Convert.ToBase64String(new byte[8]));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("shop-closures.not-found");
    }

    [Fact]
    public async Task ARunningClosureCanStillGetANewNoteWhileItsFirstDayIsPast()
    {
        await using var rig = await Rig.StartAsync(database);
        await using var later = AuthClient.WithClock(rig.Base, new FakeTimeProvider(new DateTimeOffset(2026, 11, 4, 2, 0, 0, TimeSpan.Zero)));
        var closure = await rig.AddAsync("2026-11-03", "2026-11-05", "Chirstmas");
        using var client = later.CreateClient();

        using var request = ApiRequests.Create(HttpMethod.Put, $"{Route}/{closure.Id:D}", rig.Manager.AccessToken);
        request.Content = JsonContent.Create(new { firstDay = "2026-11-03", lastDay = "2026-11-05", note = "Christmas", version = closure.Version });
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task DeletingAClosureTwiceGives204Then404()
    {
        await using var rig = await Rig.StartAsync(database);
        var closure = await rig.AddAsync("2026-12-24", null, null);

        using var first = await rig.DeleteAsync(rig.Manager, closure.Id);
        using var second = await rig.DeleteAsync(rig.Manager, closure.Id);

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await rig.ListAsync(rig.Manager)).ShouldBeEmpty();
    }

    [Fact]
    public async Task StampFieldsSentByTheClientAreIgnoredAndTheServerStampsTheManager()
    {
        await using var rig = await Rig.StartAsync(database);
        var other = await TestSessions.StartAsync(rig.Base, Roles.Admin);
        using var client = rig.Client;
        using var request = ApiRequests.Create(HttpMethod.Post, Route, rig.Manager.AccessToken);
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("D"));
        request.Content = JsonContent.Create(new
        {
            firstDay = "2026-12-24",
            createdById = other.UserId,
            updatedById = other.UserId,
            createdAtUtc = "2000-01-01T00:00:00Z",
        });

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var stored = await context.ShopClosures.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        stored.CreatedById.ShouldBe(rig.Manager.UserId);
        stored.CreatedAtUtc.ShouldBe(PinnedNow);
    }

    [Fact]
    public async Task AnAdminGets403OnEveryRouteAndNothingIsStored()
    {
        await using var rig = await Rig.StartAsync(database);
        var admin = await TestSessions.StartAsync(rig.Base, Roles.Admin);
        var closure = await rig.AddAsync("2026-12-24", null, null);

        using var read = await rig.GetAsync(admin);
        using var add = await rig.PostAsync(admin, "2026-12-30", null, null);
        using var edit = await rig.PutAsync(admin, closure.Id, "2026-12-31", null, null, closure.Version);
        using var delete = await rig.DeleteAsync(admin, closure.Id);

        new[] { read, add, edit, delete }.ShouldAllBe(response => response.StatusCode == HttpStatusCode.Forbidden);
        (await rig.ListAsync(rig.Manager)).Single().FirstDay.ShouldBe("2026-12-24");
    }

    [Fact]
    public async Task ABadFormIs400OnEachFieldWithTheApprovedMessage()
    {
        await using var rig = await Rig.StartAsync(database);

        using var response = await rig.PostAsync(rig.Manager, "2026-11-01", "2026-10-31", new string('a', 81));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var errors = (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("errors");
        errors.GetProperty("firstDay")[0].GetString().ShouldBe("Pick today or a later date.");
        errors.GetProperty("lastDay")[0].GetString().ShouldBe("The last day must be on or after the first day.");
        errors.GetProperty("note")[0].GetString().ShouldBe("Keep the note to 80 characters or fewer.");
    }

    [Fact]
    public async Task AddingChangingAndDeletingWriteTheirAuditCodesAndNeverTheNoteText()
    {
        await using var rig = await Rig.StartAsync(database);
        var closure = await rig.AddAsync("2026-12-24", "2026-12-26", "Private holiday reason");
        using var changed = await rig.PutAsync(rig.Manager, closure.Id, "2026-12-24", "2026-12-27", "Another private reason", closure.Version);
        changed.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var deleted = await rig.DeleteAsync(rig.Manager, closure.Id);
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        await using var context = database.CreateContext();
        var entries = await context.AuditLog.AsNoTracking()
            .Where(row => row.ActorUserId == rig.Manager.UserId && row.TargetType == "ShopClosure")
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);

        entries.Select(row => row.Action).ShouldBe(["shop-closure.added", "shop-closure.changed", "shop-closure.deleted"]);
        entries.ShouldAllBe(row => row.TargetId == closure.Id.ToString("D"));
        entries[0].Detail.ShouldBe("first=2026-12-24;last=2026-12-26;fields=note");
        entries[1].Detail.ShouldBe("first=2026-12-24;last=2026-12-26>2026-12-27;fields=note");
        entries[2].Detail.ShouldBe("first=2026-12-24;last=2026-12-27");
        entries.ShouldAllBe(row => !row.Detail!.Contains("private", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ASaveWithNoChangeWritesNoAuditEntryAndKeepsTheVersion()
    {
        await using var rig = await Rig.StartAsync(database);
        var closure = await rig.AddAsync("2026-12-24", "2026-12-26", "Christmas");

        using var response = await rig.PutAsync(rig.Manager, closure.Id, "2026-12-24", "2026-12-26", "Christmas", closure.Version);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var saved = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        saved.RootElement.GetProperty("version").GetString().ShouldBe(closure.Version);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == rig.Manager.UserId && row.Action == "shop-closure.changed", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    private sealed record Listed(Guid Id, string FirstDay, string LastDay, string? Note, string Version);

    private sealed class Rig : IAsyncDisposable
    {
        private readonly WebApplicationFactory<Program> _clocked;

        private Rig(WebApplicationFactory<Program> baseFactory, WebApplicationFactory<Program> clocked, StartedSession manager)
        {
            Base = baseFactory;
            _clocked = clocked;
            Manager = manager;
        }

        public WebApplicationFactory<Program> Base { get; }

        public StartedSession Manager { get; }

        public HttpClient Client => _clocked.CreateClient();

        public static async Task<Rig> StartAsync(CspsDatabase database)
        {
            await database.ResetAsync();
            var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
            var manager = await TestSessions.StartAsync(baseFactory, Roles.Manager);
            return new Rig(baseFactory, AuthClient.WithClock(baseFactory, new FakeTimeProvider(PinnedNow)), manager);
        }

        public async ValueTask DisposeAsync()
        {
            await _clocked.DisposeAsync();
            await Base.DisposeAsync();
        }

        public async Task<HttpResponseMessage> PostAsync(StartedSession who, string firstDay, string? lastDay, string? note)
        {
            using var client = _clocked.CreateClient();
            using var request = ApiRequests.Create(HttpMethod.Post, Route, who.AccessToken);
            request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("D"));
            request.Content = JsonContent.Create(new { firstDay, lastDay, note });
            return await client.SendAsync(request, TestContext.Current.CancellationToken);
        }

        public async Task<HttpResponseMessage> PutAsync(StartedSession who, Guid id, string firstDay, string? lastDay, string? note, string version)
        {
            using var client = _clocked.CreateClient();
            using var request = ApiRequests.Create(HttpMethod.Put, $"{Route}/{id:D}", who.AccessToken);
            request.Content = JsonContent.Create(new { firstDay, lastDay, note, version });
            return await client.SendAsync(request, TestContext.Current.CancellationToken);
        }

        public async Task<HttpResponseMessage> DeleteAsync(StartedSession who, Guid id)
        {
            using var client = _clocked.CreateClient();
            using var request = ApiRequests.Create(HttpMethod.Delete, $"{Route}/{id:D}", who.AccessToken);
            return await client.SendAsync(request, TestContext.Current.CancellationToken);
        }

        public async Task<HttpResponseMessage> GetAsync(StartedSession who)
        {
            using var client = _clocked.CreateClient();
            using var request = ApiRequests.Get(Route, who.AccessToken);
            return await client.SendAsync(request, TestContext.Current.CancellationToken);
        }

        public async Task<Listed> AddAsync(string firstDay, string? lastDay, string? note)
        {
            using var response = await PostAsync(Manager, firstDay, lastDay, note);
            response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            return (await response.Content.ReadFromJsonAsync<Listed>(JsonSerializerOptions.Web, TestContext.Current.CancellationToken))!;
        }

        public async Task<List<Listed>> ListAsync(StartedSession who)
        {
            using var response = await GetAsync(who);
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            return (await response.Content.ReadFromJsonAsync<List<Listed>>(JsonSerializerOptions.Web, TestContext.Current.CancellationToken))!;
        }
    }
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Users;
using Csps.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Audit;

/// <summary>
/// AUDIT-02, D-26 to D-29, D-40, USER-06: a Manager reads the audit log, newest first, with who did what to whom. The test database is
/// shared by the tests of this class and the log is append-only, so every test finds its own entries by person or by reference.
/// </summary>
public sealed class AuditLogEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/audit-log";

    [Fact]
    public async Task AManagerReadsTheLastWeekNewestFirstWithWhoDidWhatToWhom()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var managerClient = AuthClient.CreateClient(factory);
        using var staffClient = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);

        // A wrong code, then the right one: both are self-service events of the person signing in.
        using (var signIn = await AuthClient.SignInAsync(staffClient, staff.Email, staff.Password))
        {
            signIn.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var code = await AuthClient.ReadCodeAsync(staffClient, staff.Email);
        using (var wrong = await AuthClient.VerifyAsync(staffClient, AuthClient.WrongCode(code), userAgent: AuthClient.ChromeOnAndroid))
        {
            wrong.StatusCode.ShouldNotBe(HttpStatusCode.OK);
        }

        using (var right = await AuthClient.VerifyAsync(staffClient, code, userAgent: AuthClient.ChromeOnAndroid))
        {
            right.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using (var deactivated = await UserFixtures.ActionAsync(managerClient, manager.AccessToken, staff.Id, "deactivate"))
        {
            deactivated.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var page = await ReadPageAsync(managerClient, manager.AccessToken, "pageSize=100");

        page.GetProperty("page").GetInt32().ShouldBe(1);
        page.GetProperty("pageSize").GetInt32().ShouldBe(100);
        var items = page.GetProperty("items").EnumerateArray().ToList();
        page.GetProperty("total").GetInt32().ShouldBeGreaterThanOrEqualTo(items.Count);
        AssertNewestFirst(items);

        var about = items.Where(item => DoneToId(item) == staff.Id).ToList();
        var actions = about.Select(item => item.GetProperty("action").GetString()).ToList();
        actions.ShouldContain(AuditActions.TwoFactorFailed);
        actions.ShouldContain(AuditActions.TwoFactorVerified);
        actions.ShouldContain(AuditActions.SignedIn);
        actions.ShouldContain(AuditActions.UserDeactivated);

        // Self-service: the person signing in did it, and the session target resolves to them.
        var signedIn = about.Single(item => item.GetProperty("action").GetString() == AuditActions.SignedIn);
        signedIn.GetProperty("doneBy").GetProperty("kind").GetString().ShouldBe("user");
        signedIn.GetProperty("doneBy").GetProperty("person").GetProperty("id").GetGuid().ShouldBe(staff.Id);
        signedIn.GetProperty("doneBy").GetProperty("person").GetProperty("name").GetString().ShouldBe("Paolo Reyes");
        signedIn.GetProperty("doneBy").GetProperty("person").GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
        signedIn.GetProperty("device").GetString().ShouldBe(UserAgentFamily.Chrome);
        signedIn.GetProperty("reference").GetString().ShouldNotBeNull().Length.ShouldBe(AuditEntry.CorrelationIdLength);
        signedIn.GetProperty("detail").ValueKind.ShouldBe(JsonValueKind.Null);
        signedIn.GetProperty("occurredAt").GetDateTimeOffset().Offset.ShouldBe(TimeSpan.Zero);

        // A Manager's action: the Manager did it to the person.
        var deactivation = about.Single(item => item.GetProperty("action").GetString() == AuditActions.UserDeactivated);
        deactivation.GetProperty("doneBy").GetProperty("kind").GetString().ShouldBe("user");
        deactivation.GetProperty("doneBy").GetProperty("person").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        deactivation.GetProperty("doneTo").GetProperty("id").GetGuid().ShouldBe(staff.Id);
        deactivation.GetProperty("detail").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task ARoleChangeAndItsSessionRevocationReadInTheOrderTheyWereWritten()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await TestSessions.StartAsync(factory, Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, person.UserId);
        using (var save = await PutAsync(client, manager.AccessToken, person.UserId, before, "Manager"))
        {
            save.StatusCode.ShouldBe(HttpStatusCode.OK, await save.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var items = (await ReadPageAsync(client, manager.AccessToken, "pageSize=100")).GetProperty("items").EnumerateArray().ToList();

        var about = items.Where(item => DoneToId(item) == person.UserId).ToList();
        var role = about.Single(item => item.GetProperty("action").GetString() == AuditActions.UserRoleChanged);
        var revoked = about.Single(item => item.GetProperty("action").GetString() == AuditActions.SessionsRevoked);
        role.GetProperty("detail").GetString().ShouldBe("role=admin>manager");
        revoked.GetProperty("detail").GetString().ShouldBe("account-changed");
        role.GetProperty("id").GetInt64().ShouldBeLessThan(revoked.GetProperty("id").GetInt64());
        items.IndexOf(revoked).ShouldBeLessThan(items.IndexOf(role));
    }

    [Fact]
    public async Task EntriesWithTheSameTimeAreOrderedByIdDescendingSoPagingIsStable()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var at = TimeProvider.System.GetUtcNow().AddMinutes(-1);
        var first = await InsertAsync(at, null, "tie.first");
        var second = await InsertAsync(at, null, "tie.second");
        var third = await InsertAsync(at, null, "tie.third");

        var items = (await ReadPageAsync(client, manager.AccessToken, "pageSize=100")).GetProperty("items").EnumerateArray().ToList();

        var refs = items.Select(item => item.GetProperty("reference").GetString()).ToList();
        refs.IndexOf(third).ShouldBeGreaterThanOrEqualTo(0);
        refs.IndexOf(third).ShouldBeLessThan(refs.IndexOf(second));
        refs.IndexOf(second).ShouldBeLessThan(refs.IndexOf(first));
    }

    [Fact]
    public async Task OnlyTheLastSevenBusinessDaysAreListedAndTheBoundaryIsTheStartOfTheSixthDayBack()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var clock = await BusinessClockAsync(factory);
        var start = clock.UtcRange(clock.Today.AddDays(-6), clock.Today).StartUtc;
        var eightDaysAgo = await InsertAsync(clock.UtcNow.AddDays(-8), null, "old.eight-days");
        var justBefore = await InsertAsync(start.AddSeconds(-1), null, "old.just-before");
        var atStart = await InsertAsync(start, null, "old.at-start");
        var now = await InsertAsync(clock.UtcNow.AddSeconds(-5), null, "old.now");

        var refs = (await ReadPageAsync(client, manager.AccessToken, "pageSize=100")).GetProperty("items").EnumerateArray()
            .Select(item => item.GetProperty("reference").GetString()).ToList();

        refs.ShouldContain(atStart);
        refs.ShouldContain(now);
        refs.ShouldNotContain(justBefore);
        refs.ShouldNotContain(eightDaysAgo);
    }

    [Fact]
    public async Task EachEntryCarriesTheTruncatedAddressTheBrowserFamilyTheStoredDetailAndTheReference()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var reference = await InsertAsync(
            TimeProvider.System.GetUtcNow().AddSeconds(-30),
            manager.UserId,
            "user.details-changed",
            "User",
            manager.UserId.ToString("D"),
            ip: "203.0.113.77",
            userAgent: AuthClient.ChromeOnAndroid,
            detail: "fields=email");
        var bare = await InsertAsync(TimeProvider.System.GetUtcNow().AddSeconds(-31), manager.UserId, "user.activated");

        var items = (await ReadPageAsync(client, manager.AccessToken, "pageSize=100")).GetProperty("items").EnumerateArray().ToList();

        var entry = items.Single(item => item.GetProperty("reference").GetString() == reference);
        entry.GetProperty("ipPrefix").GetString().ShouldBe("203.0.113.0/24");
        entry.GetProperty("device").GetString().ShouldBe(UserAgentFamily.Chrome);
        entry.GetProperty("detail").GetString().ShouldBe("fields=email");
        entry.GetProperty("action").GetString().ShouldBe("user.details-changed");
        var empty = items.Single(item => item.GetProperty("reference").GetString() == bare);
        empty.GetProperty("ipPrefix").ValueKind.ShouldBe(JsonValueKind.Null);
        empty.GetProperty("device").GetString().ShouldBe(UserAgentFamily.Unknown);
        empty.GetProperty("doneTo").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task ADeletedPersonStaysNamedAndIsMarkedFormerStaff()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var gone = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Gil", "Gone", Roles.Admin);
        var reference = await InsertAsync(
            TimeProvider.System.GetUtcNow().AddSeconds(-20), manager.UserId, "user.activated", "User", gone.Id.ToString("D"));
        await AccountStateFixtures.MarkDeletedAsync(factory, gone.Id);

        var items = (await ReadPageAsync(client, manager.AccessToken, "pageSize=100")).GetProperty("items").EnumerateArray().ToList();

        var doneTo = items.Single(item => item.GetProperty("reference").GetString() == reference).GetProperty("doneTo");
        doneTo.GetProperty("id").GetGuid().ShouldBe(gone.Id);
        doneTo.GetProperty("name").GetString().ShouldBe($"{gone.FirstName} {gone.LastName}");
        doneTo.GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task AnAdminIsRefusedWith403AndAnAnonymousCallerWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var asAdmin = await client.SendAsync(ApiRequests.Get(Route, admin.AccessToken), TestContext.Current.CancellationToken);
        using var anonymous = await client.SendAsync(ApiRequests.Get(Route), TestContext.Current.CancellationToken);

        asAdmin.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ThereIsNoExportRoute()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        foreach (var path in new[] { $"{Route}/export", $"{Route}.csv", $"{Route}/csv" })
        {
            using var response = await client.SendAsync(ApiRequests.Get(path, manager.AccessToken), TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, path);
        }
    }

    private static async Task<JsonElement> ReadPageAsync(HttpClient client, string token, string query)
    {
        using var request = ApiRequests.Get(query.Length == 0 ? Route : $"{Route}?{query}", token);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, body);
        using var document = JsonDocument.Parse(body);
        return document.RootElement.Clone();
    }

    private static void AssertNewestFirst(List<JsonElement> items)
    {
        for (var i = 1; i < items.Count; i++)
        {
            var newer = (items[i - 1].GetProperty("occurredAt").GetDateTimeOffset(), items[i - 1].GetProperty("id").GetInt64());
            var older = (items[i].GetProperty("occurredAt").GetDateTimeOffset(), items[i].GetProperty("id").GetInt64());
            newer.CompareTo(older).ShouldBeGreaterThan(0);
        }
    }

    private static Guid? DoneToId(JsonElement item) =>
        item.GetProperty("doneTo") is { ValueKind: JsonValueKind.Object } person ? person.GetProperty("id").GetGuid() : null;

    private static async Task<HttpResponseMessage> PutAsync(HttpClient client, string accessToken, Guid id, JsonElement loaded, string role)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, $"{UserFixtures.Route}/{id:D}", accessToken);
        request.Content = JsonContent.Create(new
        {
            firstName = loaded.GetProperty("firstName").GetString(),
            lastName = loaded.GetProperty("lastName").GetString(),
            role,
            version = loaded.GetProperty("version").GetString(),
            email = loaded.GetProperty("email").GetString(),
        });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<Csps.Domain.Time.BusinessClock> BusinessClockAsync(CspsApiFactory factory)
    {
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            return await scope.ServiceProvider.GetRequiredService<IBusinessCalendar>().GetClockAsync(TestContext.Current.CancellationToken);
        }
    }

    // Writes one entry straight into the log (the only write the table allows) and returns its reference.
    private async Task<string> InsertAsync(
        DateTimeOffset at,
        Guid? actor,
        string action,
        string? targetType = null,
        string? targetId = null,
        string? ip = null,
        string? userAgent = null,
        string? detail = null)
    {
        var reference = Guid.NewGuid().ToString("N");
        await using var context = database.CreateContext();
        context.AuditLog.Add(AuditEntry.Create(
            at.ToUniversalTime(), actor, action, targetType, targetId, ip is null ? null : IPAddress.Parse(ip), userAgent, reference, detail));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return reference;
    }
}

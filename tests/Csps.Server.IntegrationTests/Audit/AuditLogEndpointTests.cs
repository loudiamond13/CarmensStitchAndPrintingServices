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
    public async Task APeopleListOffersEveryoneEverRecordedActiveAndInactiveFirstThenFormerStaffEachByName()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var tag = UserFixtures.NewTag();
        var zane = await UserFixtures.CreateAsync(factory, tag, "Zane", "Lee", Roles.Admin);
        var amy = await UserFixtures.CreateAsync(factory, tag, "Amy", "Lee", Roles.Admin);
        var bo = await UserFixtures.CreateAsync(factory, tag, "Bo", "Lee", Roles.Admin);
        var al = await UserFixtures.CreateAsync(factory, tag, "Al", "Lee", Roles.Admin);
        using (var deactivated = await UserFixtures.ActionAsync(client, manager.AccessToken, amy.Id, "deactivate"))
        {
            deactivated.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        await AccountStateFixtures.MarkDeletedAsync(factory, bo.Id);
        await AccountStateFixtures.MarkDeletedAsync(factory, al.Id);

        var people = await ReadPeopleAsync(client, manager.AccessToken);

        var ours = people.Where(person => person.GetProperty("name").GetString()!.Contains(tag, StringComparison.Ordinal)).ToList();
        ours.Select(person => person.GetProperty("id").GetGuid()).ShouldBe([amy.Id, zane.Id, al.Id, bo.Id]);
        ours.Select(person => person.GetProperty("formerStaff").GetBoolean()).ShouldBe([false, false, true, true]);
        ours[0].GetProperty("name").GetString().ShouldBe($"{amy.FirstName} {amy.LastName}");

        // Everyone current comes before everyone former, across the whole list; only id, name and formerStaff are sent (no email).
        var flags = people.Select(person => person.GetProperty("formerStaff").GetBoolean()).ToList();
        flags.SequenceEqual(flags.OrderBy(static flag => flag)).ShouldBeTrue();
        foreach (var person in people)
        {
            person.EnumerateObject().Select(static property => property.Name).Order(StringComparer.Ordinal).ShouldBe(["formerStaff", "id", "name"]);
        }
    }

    [Fact]
    public async Task APeopleListIsRefusedToAnAdminWith403AndToAnAnonymousCallerWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var asAdmin = await client.SendAsync(ApiRequests.Get($"{Route}/people", admin.AccessToken), TestContext.Current.CancellationToken);
        using var anonymous = await client.SendAsync(ApiRequests.Get($"{Route}/people"), TestContext.Current.CancellationToken);

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

    [Fact]
    public async Task TheActorFilterFindsWhatAPersonDidAndWhatTheyDidAsThemselvesAndSystemMeansNobody()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await TestSessions.StartAsync(factory, Roles.Admin);
        var other = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Oda", "Other", Roles.Admin);
        var at = TimeProvider.System.GetUtcNow().AddMinutes(-2);
        var byPerson = await InsertAsync(at, person.UserId, "user.activated", "User", other.Id.ToString("D"));
        var signedIn = await InsertAsync(at, null, "auth.signed-in", "UserSession", person.SessionId.ToString("D"));
        var asUser = await InsertAsync(at, null, "auth.2fa-verified", "User", person.UserId.ToString("D"));
        var byOther = await InsertAsync(at, manager.UserId, "user.activated", "User", other.Id.ToString("D"));
        var aboutPerson = await InsertAsync(at, null, "user.invited", "User", person.UserId.ToString("D"), detail: "bootstrap");
        var noTarget = await InsertAsync(at, null, "auth.password-reset-link-invalid");
        var unknown = await InsertAsync(at, null, "auth.sign-in-failed", detail: "unknown-account");

        var theirs = await ReferencesAsync(client, manager.AccessToken, $"actor={person.UserId:D}&pageSize=100");
        var system = await ReferencesAsync(client, manager.AccessToken, "actor=system&pageSize=100");

        theirs.ShouldContain(byPerson);
        theirs.ShouldContain(signedIn);
        theirs.ShouldContain(asUser);
        theirs.ShouldNotContain(byOther);
        theirs.ShouldNotContain(aboutPerson);
        theirs.ShouldNotContain(noTarget);
        system.ShouldContain(aboutPerson);
        system.ShouldContain(noTarget);
        system.ShouldNotContain(byPerson);
        system.ShouldNotContain(byOther);
        system.ShouldNotContain(signedIn);
        system.ShouldNotContain(asUser);
        system.ShouldNotContain(unknown);
    }

    [Fact]
    public async Task TheActionFilterKeepsOnlyThatKindOfEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var at = TimeProvider.System.GetUtcNow().AddMinutes(-2);
        var deactivated = await InsertAsync(at, manager.UserId, "user.deactivated", "User", Guid.NewGuid().ToString("D"));
        var activated = await InsertAsync(at, manager.UserId, "user.activated", "User", Guid.NewGuid().ToString("D"));

        var page = await ReadPageAsync(client, manager.AccessToken, "action=user.deactivated&pageSize=100");

        var items = page.GetProperty("items").EnumerateArray().ToList();
        items.ShouldAllBe(item => item.GetProperty("action").GetString() == "user.deactivated");
        items.Select(item => item.GetProperty("reference").GetString()).ShouldContain(deactivated);
        items.Select(item => item.GetProperty("reference").GetString()).ShouldNotContain(activated);
        page.GetProperty("total").GetInt32().ShouldBe(items.Count);
    }

    [Fact]
    public async Task TheTargetFilterFindsEntriesAboutAPersonIncludingTheirSessionEvents()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var person = await TestSessions.StartAsync(factory, Roles.Admin);
        var other = await TestSessions.StartAsync(factory, Roles.Admin);
        var at = TimeProvider.System.GetUtcNow().AddMinutes(-2);
        var aboutUser = await InsertAsync(at, manager.UserId, "user.locked", "User", person.UserId.ToString("D"));
        var aboutSession = await InsertAsync(at, null, "auth.signed-out", "UserSession", person.SessionId.ToString("D"));
        var aboutOther = await InsertAsync(at, manager.UserId, "user.locked", "User", other.UserId.ToString("D"));
        var otherSession = await InsertAsync(at, null, "auth.signed-out", "UserSession", other.SessionId.ToString("D"));

        var refs = await ReferencesAsync(client, manager.AccessToken, $"target={person.UserId:D}&pageSize=100");

        refs.ShouldContain(aboutUser);
        refs.ShouldContain(aboutSession);
        refs.ShouldNotContain(aboutOther);
        refs.ShouldNotContain(otherSession);
    }

    [Fact]
    public async Task ADayRunsFromMidnightToTheEndOfThatManilaDayAndTheNextMidnightIsLeftOut()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var subject = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Dan", "Day", Roles.Admin);
        var clock = await BusinessClockAsync(factory);
        var day = clock.Today.AddDays(-3);
        var (start, endExclusive) = clock.UtcRange(day, day);
        var key = subject.Id.ToString("D");
        var before = await InsertAsync(start.AddSeconds(-1), manager.UserId, "user.activated", "User", key);
        var atMidnight = await InsertAsync(start, manager.UserId, "user.activated", "User", key);
        var lastSecond = await InsertAsync(endExclusive.AddSeconds(-1), manager.UserId, "user.activated", "User", key);
        var nextMidnight = await InsertAsync(endExclusive, manager.UserId, "user.activated", "User", key);

        var one = await ReferencesAsync(client, manager.AccessToken, $"target={subject.Id:D}&from={day:yyyy-MM-dd}&to={day:yyyy-MM-dd}");
        var wide = await ReferencesAsync(client, manager.AccessToken, $"target={subject.Id:D}&from={day.AddDays(-1):yyyy-MM-dd}&to={day.AddDays(1):yyyy-MM-dd}");

        one.ShouldBe([lastSecond, atMidnight], ignoreOrder: false);
        wide.ShouldBe([nextMidnight, lastSecond, atMidnight, before]);
    }

    [Fact]
    public async Task ARangeFromTheStartOfTheKeptWindowToTodayIsAcceptedAndReachesTheOldestDay()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var subject = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Flo", "Floor", Roles.Admin);
        var clock = await BusinessClockAsync(factory);
        var floor = clock.Today.AddMonths(-8);
        var floorStart = clock.UtcRange(floor, floor).StartUtc;
        var oldest = await InsertAsync(floorStart, manager.UserId, "user.activated", "User", subject.Id.ToString("D"));

        var refs = await ReferencesAsync(
            client, manager.AccessToken, $"target={subject.Id:D}&from={floor:yyyy-MM-dd}&to={clock.Today:yyyy-MM-dd}");

        refs.ShouldBe([oldest]);
    }

    [Fact]
    public async Task OnlyOneDateGivenMeansUntilTodayOrFromTheStartOfTheKeptWindow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var subject = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Ona", "Once", Roles.Admin);
        var clock = await BusinessClockAsync(factory);
        var key = subject.Id.ToString("D");
        var longAgo = await InsertAsync(clock.UtcNow.AddDays(-40), manager.UserId, "user.activated", "User", key);
        var recent = await InsertAsync(clock.UtcNow.AddDays(-2), manager.UserId, "user.activated", "User", key);

        var fromOnly = await ReferencesAsync(client, manager.AccessToken, $"target={subject.Id:D}&from={clock.Today.AddDays(-10):yyyy-MM-dd}");
        var toOnly = await ReferencesAsync(client, manager.AccessToken, $"target={subject.Id:D}&to={clock.Today.AddDays(-20):yyyy-MM-dd}");

        fromOnly.ShouldBe([recent]);
        toOnly.ShouldBe([longAgo]);
    }

    [Fact]
    public async Task APageSizeAndPageSliceTheListAndTheTotalIsTheWholeCount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var subject = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Pia", "Pages", Roles.Admin);
        var at = TimeProvider.System.GetUtcNow().AddMinutes(-5);
        var first = await InsertAsync(at, manager.UserId, "user.activated", "User", subject.Id.ToString("D"));
        var second = await InsertAsync(at, manager.UserId, "user.activated", "User", subject.Id.ToString("D"));
        var third = await InsertAsync(at, manager.UserId, "user.activated", "User", subject.Id.ToString("D"));

        var one = await ReadPageAsync(client, manager.AccessToken, $"target={subject.Id:D}&pageSize=2&page=1");
        var two = await ReadPageAsync(client, manager.AccessToken, $"target={subject.Id:D}&pageSize=2&page=2");
        var past = await ReadPageAsync(client, manager.AccessToken, $"target={subject.Id:D}&pageSize=2&page=3");

        one.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("reference").GetString()).ShouldBe([third, second]);
        two.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("reference").GetString()).ShouldBe([first]);
        past.GetProperty("items").GetArrayLength().ShouldBe(0);
        (one.GetProperty("total").GetInt32(), two.GetProperty("total").GetInt32(), past.GetProperty("total").GetInt32()).ShouldBe((3, 3, 3));
    }

    [Fact]
    public async Task NoMatchIsAnEmptyListWithATotalOfZero()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        var page = await ReadPageAsync(client, manager.AccessToken, $"target={Guid.NewGuid():D}");

        page.GetProperty("items").GetArrayLength().ShouldBe(0);
        page.GetProperty("total").GetInt32().ShouldBe(0);
    }

    [Fact]
    public async Task ABadFilterIsA400NamingTheFieldWithThePlainMessage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var clock = await BusinessClockAsync(factory);
        var floor = clock.Today.AddMonths(-8);
        var window = $"Choose a date from {floor.ToString("MMM d, yyyy", System.Globalization.CultureInfo.InvariantCulture)} to today.";
        var cases = new (string Query, string Field, string Message)[]
        {
            ($"from={floor.AddDays(-1):yyyy-MM-dd}", "from", window),
            ($"to={clock.Today.AddDays(1):yyyy-MM-dd}", "to", window),
            ($"from={clock.Today:yyyy-MM-dd}&to={clock.Today.AddDays(-1):yyyy-MM-dd}", "from", "The start date must be on or before the end date."),
            ("from=2026-02-30", "from", "Enter a real date."),
            ("to=tomorrow", "to", "Enter a real date."),
            ("from=2026-2-3", "from", "Enter a real date."),
            ("actor=not-a-guid", "actor", "Choose a person from the list."),
            ("target=12345", "target", "Choose a person from the list."),
            ("action=user.exploded", "action", "Choose an action from the list."),
            ("pageSize=0", "pageSize", "Use a page size from 1 to 100."),
            ("page=0", "page", "Use a page from 1 to 100000."),
        };

        foreach (var (query, field, message) in cases)
        {
            using var response = await client.SendAsync(ApiRequests.Get($"{Route}?{query}", manager.AccessToken), TestContext.Current.CancellationToken);

            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, query);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("errors").GetProperty(field).EnumerateArray().Select(static m => m.GetString()).ShouldBe([message], query);
        }
    }

    private static async Task<List<string?>> ReferencesAsync(HttpClient client, string token, string query)
    {
        var page = await ReadPageAsync(client, token, query);
        return [.. page.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("reference").GetString())];
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

    private static async Task<List<JsonElement>> ReadPeopleAsync(HttpClient client, string token)
    {
        using var request = ApiRequests.Get($"{Route}/people", token);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, body);
        using var document = JsonDocument.Parse(body);
        return [.. document.RootElement.EnumerateArray().Select(static person => person.Clone())];
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

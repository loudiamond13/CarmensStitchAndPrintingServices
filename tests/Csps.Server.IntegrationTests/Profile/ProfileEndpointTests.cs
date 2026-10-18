using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Profile;

/// <summary>PROF-01, SEC-07, D-08, CWE-639: a staff member reads their profile and saves their name with the version the form was opened with.</summary>
public sealed class ProfileEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/profile";
    private const string StaleDetail = "This was changed by someone else. Reload and try again.";
    private const string NameChanged = "profile.name-changed";

    [Fact]
    public async Task AnAdminReadsTheirOwnProfile()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory, Roles.Admin);

        using var response = await SendAsync(client, HttpMethod.Get, session.AccessToken);
        var profile = await ReadAsync(response);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        profile.GetProperty("id").GetGuid().ShouldBe(session.UserId);
        profile.GetProperty("firstName").GetString().ShouldBe("Paolo");
        profile.GetProperty("lastName").GetString().ShouldBe("Reyes");
        profile.GetProperty("email").GetString().ShouldNotBeNullOrWhiteSpace();
        profile.GetProperty("role").GetString().ShouldBe(Roles.Admin);
        profile.GetProperty("pendingEmail").ValueKind.ShouldBe(JsonValueKind.Null);
        profile.GetProperty("memberSince").GetDateTimeOffset().Offset.ShouldBe(TimeSpan.Zero);
        profile.GetProperty("version").GetGuid().ShouldNotBe(Guid.Empty);
    }

    [Fact]
    public async Task ReadAndSaveAreNeverCached()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        using var read = await SendAsync(client, HttpMethod.Get, session.AccessToken);
        var version = (await ReadAsync(read)).GetProperty("version").GetString();

        using var save = await SendAsync(client, HttpMethod.Put, session.AccessToken, new { firstName = "Ana", lastName = "Cruz", version });

        read.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        save.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }

    [Fact]
    public async Task SavingTheNameWithTheLoadedVersionShowsOnTheNextReadAndRotatesTheVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);

        using var save = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("Ana", "Cruz", opened.Version));
        var saved = await ReadAsync(save);
        var next = await ReadProfileAsync(client, session.AccessToken);

        save.StatusCode.ShouldBe(HttpStatusCode.OK);
        saved.GetProperty("firstName").GetString().ShouldBe("Ana");
        saved.GetProperty("lastName").GetString().ShouldBe("Cruz");
        saved.GetProperty("version").GetGuid().ShouldNotBe(opened.Version);
        next.FirstName.ShouldBe("Ana");
        next.LastName.ShouldBe("Cruz");
        next.Version.ShouldBe(saved.GetProperty("version").GetGuid());
    }

    [Fact]
    public async Task StoredNamesAreTrimmed()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);

        using var save = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("  Ana  ", "\tCruz ", opened.Version));

        save.StatusCode.ShouldBe(HttpStatusCode.OK);
        var next = await ReadProfileAsync(client, session.AccessToken);
        next.FirstName.ShouldBe("Ana");
        next.LastName.ShouldBe("Cruz");
    }

    [Fact]
    public async Task ASaveFromAnOutOfDateFormIsRefusedAndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);
        using var first = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("Ana", "Cruz", opened.Version));
        first.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var stale = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("Bea", "Dela", opened.Version));
        var problem = await ReadAsync(stale);

        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        problem.GetProperty("code").GetString().ShouldBe("edit.stale");
        problem.GetProperty("detail").GetString().ShouldBe(StaleDetail);
        (await ReadProfileAsync(client, session.AccessToken)).FirstName.ShouldBe("Ana");
    }

    [Fact]
    public async Task ARandomVersionIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);

        using var response = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("Ana", "Cruz", Guid.NewGuid()));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadAsync(response)).GetProperty("code").GetString().ShouldBe("edit.stale");
    }

    [Fact]
    public async Task ASaveWithTheSameNamesAnswersOkWithoutRotatingTheVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);

        using var response = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form(" Paolo ", "Reyes", opened.Version));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadAsync(response)).GetProperty("version").GetGuid().ShouldBe(opened.Version);
        (await ReadProfileAsync(client, session.AccessToken)).Version.ShouldBe(opened.Version);
    }

    [Fact]
    public async Task RepeatingASuccessfulSaveWithItsOldVersionIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);
        using var first = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("Ana", "Cruz", opened.Version));
        first.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var again = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("Ana", "Cruz", opened.Version));

        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ReadAsync(again)).GetProperty("detail").GetString().ShouldBe(StaleDetail);
    }

    [Theory]
    [InlineData("", "Cruz", "firstName", "Enter a first name.")]
    [InlineData("   ", "Cruz", "firstName", "Enter a first name.")]
    [InlineData("Ana", "", "lastName", "Enter a last name.")]
    [InlineData("Ana", " \t ", "lastName", "Enter a last name.")]
    public async Task ABlankNameIsAFieldError(string firstName, string lastName, string field, string message)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);

        using var response = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form(firstName, lastName, opened.Version));
        var problem = await ReadAsync(response);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("errors").GetProperty(field).EnumerateArray().Select(static m => m.GetString()).ShouldBe([message]);
        (await ReadProfileAsync(client, session.AccessToken)).Version.ShouldBe(opened.Version);
    }

    [Fact]
    public async Task ANameOfExactlyOneHundredCharactersSavesAndOneHundredAndOneIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);

        using var tooLong = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form(new string('a', 101), new string('b', 101), opened.Version));
        var problem = await ReadAsync(tooLong);
        using var exact = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form(new string('a', 100), new string('b', 100), opened.Version));

        tooLong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var errors = problem.GetProperty("errors");
        errors.GetProperty("firstName").EnumerateArray().Select(static m => m.GetString()).ShouldBe(["First name must be 100 characters or fewer."]);
        errors.GetProperty("lastName").EnumerateArray().Select(static m => m.GetString()).ShouldBe(["Last name must be 100 characters or fewer."]);
        exact.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task NameLengthCountsUtf16UnitsAfterTrimming()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);
        var fiftyPairs = string.Concat(Enumerable.Repeat("\U0001F600", 50));
        var fiftyOnePairs = string.Concat(Enumerable.Repeat("\U0001F600", 51));

        using var over = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form(fiftyOnePairs, "Cruz", opened.Version));
        using var within = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form($"  {fiftyPairs}  ", "Cruz", opened.Version));

        over.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        within.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadProfileAsync(client, session.AccessToken)).FirstName.ShouldBe(fiftyPairs);
    }

    [Fact]
    public async Task AMissingVersionIsAFieldErrorOnVersion()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);

        using var response = await SendAsync(client, HttpMethod.Put, session.AccessToken, new { firstName = "Ana", lastName = "Cruz" });
        var problem = await ReadAsync(response);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("errors").GetProperty("version").EnumerateArray().Select(static m => m.GetString()).ShouldBe(["Reload the form and try again."]);
    }

    [Theory]
    [InlineData("not-a-guid")]
    [InlineData("")]
    [InlineData("{6f1d3c52-8a0e-4b7d-9c41-2e5a7b9d0f13}")]
    [InlineData("6f1d3c528a0e4b7d9c412e5a7b9d0f13")]
    public async Task AMalformedVersionIsTheSameFieldError(string version)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);

        using var response = await SendAsync(client, HttpMethod.Put, session.AccessToken, new { firstName = "Ana", lastName = "Cruz", version });
        var problem = await ReadAsync(response);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("errors").GetProperty("version").EnumerateArray().Select(static m => m.GetString()).ShouldBe(["Reload the form and try again."]);
    }

    [Fact]
    public async Task ABodyWithNoContentIsFieldErrorsNotAServerError()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);

        using var response = await SendAsync(client, HttpMethod.Put, session.AccessToken);
        var errors = (await ReadAsync(response)).GetProperty("errors");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        errors.TryGetProperty("firstName", out _).ShouldBeTrue();
        errors.TryGetProperty("lastName", out _).ShouldBeTrue();
        errors.TryGetProperty("version", out _).ShouldBeTrue();
    }

    [Fact]
    public async Task AFailedPasswordCountBetweenReadAndSaveDoesNotCauseAConflict()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
            _ = await accounts.RecordFailedPasswordAsync(session.UserId, TestContext.Current.CancellationToken);
            await accounts.MarkBreachRecheckAsync(session.UserId, TestContext.Current.CancellationToken);
        }

        using var save = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("Ana", "Cruz", opened.Version));

        save.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadProfileAsync(client, session.AccessToken)).FirstName.ShouldBe("Ana");
    }

    [Fact]
    public async Task ARealNameChangeWritesOneAuditEntryWithFieldNamesOnly()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);

        using var save = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("Ana", "Reyes", opened.Version));

        save.StatusCode.ShouldBe(HttpStatusCode.OK);
        var entry = (await NameEntriesAsync(session.UserId)).ShouldHaveSingleItem();
        entry.TargetType.ShouldBe("User");
        var detail = entry.Detail.ShouldNotBeNull();
        detail.ShouldBe("fields=first-name");
        detail.ShouldNotContain("Ana");
        detail.ShouldNotContain("Paolo");
        detail.ShouldNotContain("Reyes");
    }

    [Fact]
    public async Task ChangingBothNamesListsBothFieldsAndTwoSavesWriteTwoEntries()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);
        using var first = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("Ana", "Cruz", opened.Version));
        var next = await ReadProfileAsync(client, session.AccessToken);

        using var second = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("Ana", "Dela", next.Version));

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await NameEntriesAsync(session.UserId)).Select(static entry => entry.Detail).Order().ShouldBe(["fields=first-name,last-name", "fields=last-name"]);
    }

    [Fact]
    public async Task ASaveThatChangesNothingWritesNoAuditEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);

        using var response = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form(" Paolo ", "Reyes", opened.Version));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await NameEntriesAsync(session.UserId)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AStaleOrInvalidSaveWritesNoAuditEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var session = await TestSessions.StartAsync(factory);
        var opened = await ReadProfileAsync(client, session.AccessToken);

        using var stale = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("Ana", "Cruz", Guid.NewGuid()));
        using var invalid = await SendAsync(client, HttpMethod.Put, session.AccessToken, Form("", "Cruz", opened.Version));

        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await NameEntriesAsync(session.UserId)).ShouldBeEmpty();
    }

    [Fact]
    public async Task SavingMyNameNeverTouchesAnotherAccount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var me = await TestSessions.StartAsync(factory);
        var someoneElse = await TestSessions.StartAsync(factory);
        var mine = await ReadProfileAsync(client, me.AccessToken);
        var theirsBefore = await ReadProfileAsync(client, someoneElse.AccessToken);

        using var save = await SendAsync(client, HttpMethod.Put, me.AccessToken, Form("Ana", "Cruz", mine.Version));

        save.StatusCode.ShouldBe(HttpStatusCode.OK);
        var theirsAfter = await ReadProfileAsync(client, someoneElse.AccessToken);
        theirsAfter.Id.ShouldBe(someoneElse.UserId);
        theirsAfter.FirstName.ShouldBe(theirsBefore.FirstName);
        theirsAfter.LastName.ShouldBe(theirsBefore.LastName);
        theirsAfter.Version.ShouldBe(theirsBefore.Version);
    }

    [Fact]
    public async Task AnAnonymousCallerIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var read = await SendAsync(client, HttpMethod.Get, null);
        using var save = await SendAsync(client, HttpMethod.Put, null, Form("Ana", "Cruz", Guid.NewGuid()));

        read.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        save.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private async Task<List<NameEntry>> NameEntriesAsync(Guid userId)
    {
        await using var context = database.CreateContext();
        var key = userId.ToString("D");
        return await context.AuditLog.AsNoTracking()
            .Where(entry => entry.Action == NameChanged && entry.TargetId == key)
            .Select(static entry => new NameEntry(entry.TargetType, entry.Detail))
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private static object Form(string firstName, string lastName, Guid version) => Form(firstName, lastName, version.ToString("D"));

    private static object Form(string firstName, string lastName, string? version) => new { firstName, lastName, version };

    private static async Task<HttpResponseMessage> SendAsync(HttpClient client, HttpMethod method, string? accessToken, object? body = null)
    {
        using var request = ApiRequests.Create(method, Route, accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.Clone();
    }

    private static async Task<ReadProfile> ReadProfileAsync(HttpClient client, string accessToken)
    {
        using var response = await SendAsync(client, HttpMethod.Get, accessToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await ReadAsync(response);
        return new ReadProfile(
            body.GetProperty("id").GetGuid(),
            body.GetProperty("firstName").GetString().ShouldNotBeNull(),
            body.GetProperty("lastName").GetString().ShouldNotBeNull(),
            body.GetProperty("version").GetGuid());
    }

    private sealed record ReadProfile(Guid Id, string FirstName, string LastName, Guid Version);

    private sealed record NameEntry(string? TargetType, string? Detail);
}

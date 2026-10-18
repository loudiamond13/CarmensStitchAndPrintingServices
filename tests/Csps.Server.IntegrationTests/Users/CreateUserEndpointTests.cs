using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>
/// USER-02, C-4, D-12..D-15, SEC-08, SEC-06: a Manager adds a staff member by an emailed 7-day invitation or with a
/// temporary password, attributed to the Manager, safe to retry and race-safe on the email.
/// </summary>
public sealed class CreateUserEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/users";

    // TestSessions names every account it makes Paolo Reyes.
    private const string ManagerName = "Paolo Reyes";
    private const string FirstPassword = "Mabuhay#Tahi2026";
    private const string TemporaryPassword = "Tela-Sukat-7381";

    [Fact]
    public async Task AManagerInvitesAnaWhoReadsWhoSetUpHerAccountSetsHerPasswordAndSignsIn()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var email = NewEmail("ana");

        using var created = await PostAsync(client, manager.AccessToken, Body("Ana", "Abad", email, "Admin", "invitation"));

        created.StatusCode.ShouldBe(HttpStatusCode.Created, await created.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var id = await ReadIdAsync(created);
        created.Headers.Location.ShouldNotBeNull().OriginalString.ShouldEndWith($"{Route}/{id:D}");

        var listed = (await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={Uri.EscapeDataString(email)}")).Items.ShouldHaveSingleItem();
        listed.Id.ShouldBe(id);
        listed.InviteState.ShouldBe("pending");
        listed.Status.ShouldBe("active");
        listed.Role.ShouldBe(Roles.Admin);

        var invite = (await AuthClient.WaitForEmailsAsync(client, email)).ShouldHaveSingleItem();
        invite.Subject.ShouldBe("Set up your CSPS staff account");
        var opening = $"{ManagerName} set up your account.";
        invite.Text.ShouldContain(opening);
        invite.Text.IndexOf(opening, StringComparison.Ordinal).ShouldBeLessThan(invite.Text.IndexOf("A staff account at", StringComparison.Ordinal));
        invite.Text.ShouldContain("This link works for 7 days and only once.");

        using (var accept = await AuthClient.AcceptInviteAsync(client, AuthClient.TokenOf(invite), FirstPassword))
        {
            accept.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var verify = await AuthClient.SignInThroughCodeAsync(client, new TestStaff(id, email, FirstPassword), signInsSoFar: 1);
        verify.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var body = JsonDocument.Parse(await verify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        body.RootElement.GetProperty("session").GetProperty("user").GetProperty("role").GetString().ShouldBe(Roles.Admin);

        await using var context = database.CreateContext();
        var key = id.ToString("D");
        var invited = await context.AuditLog.AsNoTracking()
            .Where(entry => entry.Action == AuditActions.UserInvited && entry.TargetId == key)
            .SingleAsync(TestContext.Current.CancellationToken);
        invited.TargetType.ShouldBe("User");
        invited.Detail.ShouldBe("manager");
        invited.ActorUserId.ShouldBe(manager.UserId);
    }

    [Fact]
    public async Task AnAdminIsRefusedWith403AndAnAnonymousCallerWith401AndNothingIsCreated()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var email = NewEmail("blocked");

        using var asAdmin = await PostAsync(client, admin.AccessToken, Body("Bea", "Bautista", email, "Admin", "invitation"));
        using var anonymous = await PostAsync(client, null, Body("Bea", "Bautista", email, "Admin", "invitation"));

        asAdmin.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        await using var context = database.CreateContext();
        (await context.Users.AnyAsync(user => user.Email == email, TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    [Fact]
    public async Task ATemporaryPasswordNeedsTheCodeThenANewPasswordAndIsNeverReturnedOrEmailed()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var email = NewEmail("tess");

        using var created = await PostAsync(client, manager.AccessToken, Body("Tess", "Tan", email, "Manager", "temporary-password", TemporaryPassword));

        var raw = await created.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        created.StatusCode.ShouldBe(HttpStatusCode.Created, raw);
        raw.ShouldNotContain(TemporaryPassword);
        using (var document = JsonDocument.Parse(raw))
        {
            document.RootElement.EnumerateObject().Select(property => property.Name).ShouldBe(["id"]);
        }

        var id = await ReadIdAsync(created);
        var listed = (await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={Uri.EscapeDataString(email)}")).Items.ShouldHaveSingleItem();
        listed.Id.ShouldBe(id);
        listed.Role.ShouldBe(Roles.Manager);
        listed.InviteState.ShouldBe("none");

        var staff = new TestStaff(id, email, TemporaryPassword);
        using var verify = await AuthClient.SignInThroughCodeAsync(client, staff);
        verify.StatusCode.ShouldBe(HttpStatusCode.OK);
        using (var verified = JsonDocument.Parse(await verify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)))
        {
            verified.RootElement.GetProperty("next").GetString().ShouldBe("set-new-password");
            verified.RootElement.GetProperty("reason").GetString().ShouldBe("temporary");
        }

        // The sign-in code is the only mail so far: no invitation went out, and no mail holds the password.
        var mails = await AuthClient.ReadEmailsAsync(client, email);
        mails.ShouldHaveSingleItem().Subject.ShouldContain("sign-in code");
        mails.ShouldAllBe(mail => !mail.Text.Contains(TemporaryPassword, StringComparison.Ordinal) && !mail.Html.Contains(TemporaryPassword, StringComparison.Ordinal));

        using var saved = await AuthClient.SetNewPasswordAsync(client, FirstPassword);
        saved.StatusCode.ShouldBe(HttpStatusCode.OK);

        await using var context = database.CreateContext();
        var key = id.ToString("D");
        var audit = await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && entry.Action == "user.created-temporary")
            .SingleAsync(TestContext.Current.CancellationToken);
        audit.Detail.ShouldBeNull();
        audit.ActorUserId.ShouldBe(manager.UserId);
    }

    [Theory]
    [InlineData("Ab1!", "Use at least 8 characters.")]
    [InlineData("Abcdefgh!", "Add at least one number.")]
    [InlineData("Abcdefg1h", "Add at least one symbol, like ! or #.")]
    [InlineData("Abcdef1!\tx", "Remove tabs and line breaks from your password.")]
    [InlineData("", "Enter a temporary password.")]
    [InlineData(null, "Enter a temporary password.")]
    public async Task ATemporaryPasswordThatBreaksTheBasicRuleIsA400OnItsFieldAndNothingIsCreated(string? password, string message)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var email = NewEmail("rule");

        using var response = await PostAsync(client, manager.AccessToken, Body("Rina", "Rule", email, "Admin", "temporary-password", password));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("temporaryPassword").EnumerateArray().Select(item => item.GetString()).ShouldBe([message]);
        await using var context = database.CreateContext();
        (await context.Users.AnyAsync(user => user.Email == email, TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    [Fact]
    public async Task ASixtyFiveCharacterPasswordIsRefusedAndSixtyFourIsAccepted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var over = await PostAsync(client, manager.AccessToken, Body("Len", "Over", NewEmail("over"), "Admin", "temporary-password", "Aa1!" + new string('x', 61)));
        using var at = await PostAsync(client, manager.AccessToken, Body("Len", "At", NewEmail("at"), "Admin", "temporary-password", "Aa1!" + new string('x', 60)));

        over.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(over, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("temporaryPassword")[0].GetString()
            .ShouldBe("Use 64 characters or fewer.");
        at.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task ABreachedLookingButBasicValidPasswordIsAcceptedAndTheIdempotencyRecordHoldsNoCopyOfIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var key = Guid.NewGuid();
        const string Common = "Password1!";

        using var response = await PostAsync(client, manager.AccessToken, Body("Bree", "Common", NewEmail("common"), "Admin", "temporary-password", Common), key);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        await using var context = database.CreateContext();
        var record = await context.IdempotencyRecords.AsNoTracking().SingleAsync(item => item.Key == key, TestContext.Current.CancellationToken);
        record.StatusCode.ShouldBe(201);
        record.RequestHash.Length.ShouldBe(32);
        new[] { record.ResponseBody, record.Location, record.Route, record.ResponseContentType }
            .ShouldAllBe(text => text == null || !text.Contains(Common, StringComparison.Ordinal));
        Convert.ToHexString(record.RequestHash).ShouldNotContain(Convert.ToHexString(System.Text.Encoding.UTF8.GetBytes(Common)));
    }

    [Theory]
    [InlineData("invitation", null)]
    [InlineData("temporary-password", TemporaryPassword)]
    public async Task TheCreatorAndTheTimeComeFromTheTokenAndTheClockWhateverTheBodyClaims(string access, string? password)
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var manager = await TestSessions.StartAsync(baseFactory, Roles.Manager);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var email = NewEmail("stamp");
        var forged = Guid.NewGuid();
        var body = Body("Sol", "Stamp", email, "Admin", access, password);
        body["createdById"] = forged;
        body["createdAtUtc"] = "2001-01-01T00:00:00+00:00";
        body["updatedById"] = forged;
        body["updatedAtUtc"] = "2002-02-02T00:00:00+00:00";

        using var created = await PostAsync(client, manager.AccessToken, body);

        created.StatusCode.ShouldBe(HttpStatusCode.Created, await created.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var row = await ReadRowAsync(await ReadIdAsync(created));
        row.CreatedById.ShouldBe(manager.UserId);
        row.CreatedAtUtc.ShouldBe(clock.GetUtcNow());
        row.CreatedAtUtc.Offset.ShouldBe(TimeSpan.Zero);
        row.UpdatedById.ShouldBeNull();
        row.UpdatedAtUtc.ShouldBeNull();
    }

    [Fact]
    public async Task ARepeatedKeyAndBodyGivesTheFirstAnswerBackWithOneAccountOneInviteAndNoNewStamp()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var manager = await TestSessions.StartAsync(baseFactory, Roles.Manager);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var email = NewEmail("again");
        var key = Guid.NewGuid();
        var body = Body("Ria", "Again", email, "Admin", "invitation");

        using var first = await PostAsync(client, manager.AccessToken, body, key);
        var afterFirst = await ReadRowAsync(await ReadIdAsync(first));
        clock.Advance(TimeSpan.FromMinutes(10));
        using var second = await PostAsync(client, manager.AccessToken, body, key);

        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        first.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        second.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");
        (await ReadIdAsync(second)).ShouldBe(afterFirst.Id);
        second.Headers.Location.ShouldBe(first.Headers.Location);

        (await AuthClient.WaitForEmailsAsync(client, email)).ShouldHaveSingleItem();
        await using var context = database.CreateContext();
        (await context.Users.CountAsync(user => user.Email == email, TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.EmailOutbox.CountAsync(mail => mail.ToAddress == email, TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.AccountTokens.CountAsync(token => token.UserId == afterFirst.Id, TestContext.Current.CancellationToken)).ShouldBe(1);
        var afterSecond = await ReadRowAsync(afterFirst.Id);
        afterSecond.ShouldBe(afterFirst);
    }

    [Fact]
    public async Task TheEmailIsTrimmedAndComparedWithoutRegardToLetterCase()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var existing = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Una", "Used");

        using var response = await PostAsync(client, manager.AccessToken, Body("Una", "Twin", $"  {existing.Email.ToUpperInvariant()} ", "Admin", "invitation"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("email")[0].GetString()
            .ShouldBe("Another account already uses this email.");
        await using var context = database.CreateContext();
        var normalized = existing.Email.ToUpperInvariant();
        (await context.Users.CountAsync(user => user.NormalizedEmail == normalized, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task TwoCreatesWithTheSameEmailSentTogetherGiveOneAccountAndOneEmailFieldErrorEveryTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        for (var run = 0; run < 20; run++)
        {
            var email = NewEmail($"race{run}");
            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => PostAsync(client, manager.AccessToken, Body("Rae", "One", email, "Admin", "invitation")),
                () => PostAsync(client, manager.AccessToken, Body("Rae", "Two", email, "Manager", "temporary-password", TemporaryPassword)));
            using (first)
            using (second)
            {
                var statuses = new[] { first.StatusCode, second.StatusCode }.Order().ToArray();
                statuses.ShouldBe([HttpStatusCode.Created, HttpStatusCode.BadRequest], $"run {run}");
                var loser = first.StatusCode == HttpStatusCode.BadRequest ? first : second;
                (await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("email")[0].GetString()
                    .ShouldBe("Another account already uses this email.", $"run {run}");
            }

            await using var context = database.CreateContext();
            (await context.Users.CountAsync(user => user.Email == email, TestContext.Current.CancellationToken)).ShouldBe(1, $"run {run}");
        }
    }

    [Fact]
    public async Task AnAddressOfADeletedAccountCanBeInvitedAgainAsASeparateNewAccount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var old = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Olga", "Old");
        await DeleteLikeTheDeleteActionAsync(old.Id);

        using var response = await PostAsync(client, manager.AccessToken, Body("Olga", "New", old.Email, "Admin", "invitation"));

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var id = await ReadIdAsync(response);
        id.ShouldNotBe(old.Id);
        var listed = (await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={Uri.EscapeDataString(old.Email)}")).Items.ShouldHaveSingleItem();
        listed.Id.ShouldBe(id);
        await using var context = database.CreateContext();
        (await context.Users.AnyAsync(user => user.Id == old.Id && user.DeletedAtUtc != null, TestContext.Current.CancellationToken)).ShouldBeTrue();
    }

    private static string NewEmail(string name) => $"{name}.{Guid.NewGuid():N}@example.com";

    // A delete frees the address by scrambling it on the old row (D-07, D-10); the delete action itself comes in a later plan.
    private async Task DeleteLikeTheDeleteActionAsync(Guid id)
    {
        var scrambled = $"deleted.{Guid.NewGuid():N}@deleted.invalid";
        await using var context = database.CreateContext();
        var changed = await context.Users.Where(user => user.Id == id).ExecuteUpdateAsync(
            set => set
                .SetProperty(user => user.Email, scrambled)
                .SetProperty(user => user.UserName, scrambled)
                .SetProperty(user => user.NormalizedEmail, scrambled.ToUpperInvariant())
                .SetProperty(user => user.NormalizedUserName, scrambled.ToUpperInvariant())
                .SetProperty(user => user.DeletedAtUtc, TimeProvider.System.GetUtcNow()),
            TestContext.Current.CancellationToken);
        changed.ShouldBe(1);
    }

    private async Task<Row> ReadRowAsync(Guid id)
    {
        await using var context = database.CreateContext();
        return await context.Users.AsNoTracking()
            .Where(user => user.Id == id)
            .Select(user => new Row(user.Id, user.CreatedById, user.CreatedAtUtc, user.UpdatedById, user.UpdatedAtUtc))
            .SingleAsync(TestContext.Current.CancellationToken);
    }

    private sealed record Row(Guid Id, Guid? CreatedById, DateTimeOffset CreatedAtUtc, Guid? UpdatedById, DateTimeOffset? UpdatedAtUtc);

    private static Dictionary<string, object?> Body(string first, string last, string? email, string? role, string? access, string? temporaryPassword = null) =>
        new()
        {
            ["firstName"] = first,
            ["lastName"] = last,
            ["email"] = email,
            ["role"] = role,
            ["access"] = access,
            ["temporaryPassword"] = temporaryPassword,
        };

    private static async Task<HttpResponseMessage> PostAsync(HttpClient client, string? accessToken, object body, Guid? key = null)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, Route, accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (key ?? Guid.NewGuid()).ToString("D"));
        request.Content = JsonContent.Create(body);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<Guid> ReadIdAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.GetProperty("id").GetGuid();
    }
}

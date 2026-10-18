using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Profile;

/// <summary>
/// PROF-02, D-24, D-40, T-05-40: while an email change is waiting, the caller can send a fresh link (the older one dies) or
/// call the change off, and the sign-in email stays the current one throughout.
/// </summary>
public sealed class EmailChangePendingTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string RequestRoute = "/api/v1/profile/email-change";
    private const string ResendRoute = "/api/v1/profile/email-change/resend";
    private const string ConfirmRoute = "/api/v1/profile/email-change/confirm";
    private const string CheckRoute = "/api/v1/profile/email-change/check";
    private const string ConfirmSubject = "Confirm your new CSPS email";

    [Fact]
    public async Task AWaitingChangeShowsOnTheProfileAndSignInKeepsUsingTheCurrentEmail()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var newEmail = AuthClient.NewEmail();
        await RequestAndReadTokenAsync(client, device.AccessToken, newEmail, staff.Password);

        using var profileResponse = await GetProfileAsync(client, device.AccessToken);
        var profile = await ReadAsync(profileResponse);

        profile.GetProperty("email").GetString().ShouldBe(staff.Email);
        profile.GetProperty("pendingEmail").GetString().ShouldBe(newEmail);
        using var fresh = AuthClient.CreateClient(factory);
        using var withOld = await AuthClient.SignInAsync(fresh, staff.Email, staff.Password);
        using var withNew = await AuthClient.SignInAsync(fresh, newEmail, staff.Password);
        withOld.StatusCode.ShouldBe(HttpStatusCode.OK);
        withNew.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ResendEmailsAFreshLinkToThePendingAddressOnlyAndTheFirstLinkDies()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var newEmail = AuthClient.NewEmail();
        var first = await RequestAndReadTokenAsync(client, device.AccessToken, newEmail, staff.Password);
        var toOldBefore = (await AuthClient.WaitForEmailsAsync(client, staff.Email, count: 2)).Count;

        using var resend = await ResendAsync(client, device.AccessToken);

        resend.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var toNew = await AuthClient.WaitForEmailsAsync(client, newEmail, count: 2);
        toNew.ShouldAllBe(static mail => mail.Subject == ConfirmSubject);
        var second = AuthClient.TokenOf(toNew[^1]);
        second.ShouldNotBe(first);
        (await AuthClient.ReadEmailsAsync(client, staff.Email)).Count.ShouldBe(toOldBefore);

        using var staleCheck = await CheckAsync(client, first);
        using var staleConfirm = await ConfirmAsync(client, first);
        staleCheck.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        staleConfirm.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(staleConfirm, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("email-change.invalid");

        using var liveConfirm = await ConfirmAsync(client, second);
        liveConfirm.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadAsync(liveConfirm)).GetProperty("newEmail").GetString().ShouldBe(newEmail);
    }

    [Fact]
    public async Task TheResentLinkLastsAFreshTwentyFourHours()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var newEmail = AuthClient.NewEmail();
        await RequestAndReadTokenAsync(client, device.AccessToken, newEmail, staff.Password);

        clock.Advance(TimeSpan.FromHours(20));
        using var resend = await ResendAsync(client, device.AccessToken);
        resend.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var second = AuthClient.TokenOf((await AuthClient.WaitForEmailsAsync(client, newEmail, count: 2))[^1]);

        clock.Advance(TimeSpan.FromHours(23));
        using var stillLive = await CheckAsync(client, second);

        stillLive.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ResendWithNothingWaitingIsA404EmailChangeNone()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var resend = await ResendAsync(client, device.AccessToken);
        var problem = await ProblemJson.ReadAsync(resend, TestContext.Current.CancellationToken);

        resend.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        problem.GetProperty("code").GetString().ShouldBe("email-change.none");
        problem.GetProperty("detail").GetString().ShouldBe("There is no email change waiting.");
    }

    [Fact]
    public async Task ResendAfterAConfirmedChangeFindsNothingWaiting()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var token = await RequestAndReadTokenAsync(client, device.AccessToken, AuthClient.NewEmail(), staff.Password);
        using var confirm = await ConfirmAsync(client, token);
        confirm.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var resend = await ResendAsync(client, device.AccessToken);

        resend.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CancelClearsThePendingChangeKillsTheLinkAndKeepsTheCurrentEmail()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var newEmail = AuthClient.NewEmail();
        var token = await RequestAndReadTokenAsync(client, device.AccessToken, newEmail, staff.Password);

        using var cancel = await CancelAsync(client, device.AccessToken);

        cancel.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var profileResponse = await GetProfileAsync(client, device.AccessToken);
        var profile = await ReadAsync(profileResponse);
        profile.GetProperty("email").GetString().ShouldBe(staff.Email);
        profile.GetProperty("pendingEmail").ValueKind.ShouldBe(JsonValueKind.Null);
        using var check = await CheckAsync(client, token);
        using var confirm = await ConfirmAsync(client, token);
        check.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        confirm.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        using var fresh = AuthClient.CreateClient(factory);
        using var withOld = await AuthClient.SignInAsync(fresh, staff.Email, staff.Password);
        withOld.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().SingleAsync(row => row.Id == staff.Id, TestContext.Current.CancellationToken)).Email.ShouldBe(staff.Email);
    }

    [Fact]
    public async Task CancelAgainAnswers204AndWritesNoNewAuditEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        await RequestAndReadTokenAsync(client, device.AccessToken, AuthClient.NewEmail(), staff.Password);
        using (var first = await CancelAsync(client, device.AccessToken))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var before = await CountAuditAsync(staff.Id, "profile.email-change-canceled");
        using var second = await CancelAsync(client, device.AccessToken);

        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        before.ShouldBe(1);
        (await CountAuditAsync(staff.Id, "profile.email-change-canceled")).ShouldBe(1);
    }

    [Fact]
    public async Task CancelWithNothingEverRequestedAnswers204AndWritesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var cancel = await CancelAsync(client, device.AccessToken);

        cancel.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await CountAuditAsync(staff.Id, "profile.email-change-canceled")).ShouldBe(0);
    }

    [Fact]
    public async Task ResendIsAuditedAsRequestedWithTheDetailResentAndCancelWithNoDetail()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var newEmail = AuthClient.NewEmail();
        await RequestAndReadTokenAsync(client, device.AccessToken, newEmail, staff.Password);
        using (var resend = await ResendAsync(client, device.AccessToken))
        {
            resend.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using (var cancel = await CancelAsync(client, device.AccessToken))
        {
            cancel.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        await using var context = database.CreateContext();
        var key = staff.Id.ToString("D");
        var entries = await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && entry.Action.StartsWith("profile.email-change"))
            .ToListAsync(TestContext.Current.CancellationToken);

        var requested = entries.Where(static entry => entry.Action == "profile.email-change-requested").ToList();
        requested.Count.ShouldBe(2);
        requested.Select(static entry => entry.Detail).Order().ShouldBe([null, "resent"]);
        var canceled = entries.Single(static entry => entry.Action == "profile.email-change-canceled");
        canceled.TargetType.ShouldBe("User");
        canceled.ActorUserId.ShouldBe(staff.Id);
        canceled.Detail.ShouldBeNull();
        var everything = await context.AuditLog.AsNoTracking().Select(static entry => (entry.Detail ?? string.Empty) + "|" + (entry.TargetId ?? string.Empty)).ToListAsync(TestContext.Current.CancellationToken);
        everything.ShouldAllBe(text => !text.Contains(newEmail, StringComparison.OrdinalIgnoreCase) && !text.Contains(staff.Email, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ARequestAfterACancelStartsAFreshChange()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var first = await RequestAndReadTokenAsync(client, device.AccessToken, AuthClient.NewEmail(), staff.Password);
        using (var cancel = await CancelAsync(client, device.AccessToken))
        {
            cancel.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var newEmail = AuthClient.NewEmail();
        var second = await RequestAndReadTokenAsync(client, device.AccessToken, newEmail, staff.Password);

        using var stale = await ConfirmAsync(client, first);
        using var live = await ConfirmAsync(client, second);
        stale.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        live.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AnAnonymousCallerCanNeitherResendNorCancel()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var resend = await ResendAsync(client, null);
        using var cancel = await CancelAsync(client, null);

        resend.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        cancel.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AResendWithoutAnIdempotencyKeyIsRefusedAndSendsNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var newEmail = AuthClient.NewEmail();
        await RequestAndReadTokenAsync(client, device.AccessToken, newEmail, staff.Password);

        using var resend = await ResendAsync(client, device.AccessToken, idempotencyKey: false);
        var problem = await ProblemJson.ReadAsync(resend, TestContext.Current.CancellationToken);

        resend.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("code").GetString().ShouldBe("idempotency.key-missing");
        (await AuthClient.ReadEmailsAsync(client, newEmail)).Count.ShouldBe(1);
    }

    private async Task<int> CountAuditAsync(Guid userId, string action)
    {
        await using var context = database.CreateContext();
        var key = userId.ToString("D");
        return await context.AuditLog.AsNoTracking().CountAsync(entry => entry.TargetId == key && entry.Action == action, TestContext.Current.CancellationToken);
    }

    private static async Task<string> RequestAndReadTokenAsync(HttpClient client, string accessToken, string newEmail, string password)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, RequestRoute, accessToken);
        request.Content = JsonContent.Create(new { newEmail, currentPassword = password });
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var mail = (await AuthClient.WaitForEmailsAsync(client, newEmail)).Single(static message => message.Subject == ConfirmSubject);
        return AuthClient.TokenOf(mail);
    }

    private static async Task<HttpResponseMessage> GetProfileAsync(HttpClient client, string accessToken)
    {
        using var request = ApiRequests.Get("/api/v1/profile", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    private static async Task<HttpResponseMessage> ResendAsync(HttpClient client, string? accessToken, bool idempotencyKey = true)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, ResendRoute, accessToken);
        if (idempotencyKey)
        {
            request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> CancelAsync(HttpClient client, string? accessToken)
    {
        using var request = ApiRequests.Create(HttpMethod.Delete, RequestRoute, accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> CheckAsync(HttpClient client, string? token)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, CheckRoute);
        request.Content = JsonContent.Create(new { token });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> ConfirmAsync(HttpClient client, string? token)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, ConfirmRoute);
        request.Content = JsonContent.Create(new { token });
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}

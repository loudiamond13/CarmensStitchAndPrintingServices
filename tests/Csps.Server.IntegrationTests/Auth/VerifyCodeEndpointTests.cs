using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-02, AUTH-05, D-03, AUDIT-01: the emailed code turns the pending ticket into a session whose refresh cookie
/// matches the chosen session kind, and a code only ever works with its own ticket.
/// </summary>
public sealed class VerifyCodeEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task ACorrectCodeStartsAPersistentSession()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password, keepSignedIn: true);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);

        using var response = await AuthClient.VerifyAsync(client, code);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var root = body.RootElement;
        root.GetProperty("next").GetString().ShouldBe("signed-in");
        var session = root.GetProperty("session");
        session.GetProperty("persistent").GetBoolean().ShouldBeTrue();
        var user = session.GetProperty("user");
        user.GetProperty("id").GetGuid().ShouldBe(staff.Id);
        user.GetProperty("email").GetString().ShouldBe(staff.Email);
        user.GetProperty("firstName").GetString().ShouldBe("Paolo");
        user.GetProperty("lastName").GetString().ShouldBe("Reyes");
        user.GetProperty("role").GetString().ShouldBe("Manager");
        var now = TimeProvider.System.GetUtcNow();
        (session.GetProperty("sessionExpiresAt").GetDateTimeOffset() - now).ShouldBeInRange(TimeSpan.FromDays(89.9), TimeSpan.FromDays(90.1));

        var cookies = response.Headers.GetValues("Set-Cookie").Select(static header => SetCookieHeaderValue.Parse(header)).ToList();
        var refresh = cookies.Single(cookie => cookie.Name.Value == "__Secure-csps_rt");
        refresh.HttpOnly.ShouldBeTrue();
        refresh.Secure.ShouldBeTrue();
        refresh.SameSite.ShouldBe(SameSiteMode.Strict);
        refresh.Path.Value.ShouldBe("/api/v1/auth");
        refresh.Value.Value.ShouldNotBeNullOrWhiteSpace();
        (refresh.Expires.ShouldNotBeNull() - now).ShouldBeInRange(TimeSpan.FromDays(89.9), TimeSpan.FromDays(90.1));
        var ticket = cookies.Single(cookie => cookie.Name.Value == "__Secure-csps_2fa");
        ticket.Expires.ShouldNotBeNull().ShouldBeLessThan(now);

        var accessToken = session.GetProperty("accessToken").GetString().ShouldNotBeNull();
        using var siteSettings = ApiRequests.Get("/api/v1/site-settings", accessToken);
        using var siteSettingsResponse = await client.SendAsync(siteSettings, TestContext.Current.CancellationToken);
        siteSettingsResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var sessionId = new JsonWebToken(accessToken).GetClaim("sid").Value;
        await using var context = database.CreateContext();
        var userKey = staff.Id.ToString("D");
        var audits = await context.AuditLog.AsNoTracking()
            .Where(a => a.TargetId == userKey || a.TargetId == sessionId)
            .Select(a => new { a.Action, a.TargetType, a.TargetId, a.Detail })
            .ToListAsync(TestContext.Current.CancellationToken);
        audits.ShouldContain(a => a.Action == AuditActions.TwoFactorVerified && a.TargetType == "User" && a.TargetId == userKey && a.Detail == null);
        audits.ShouldContain(a => a.Action == AuditActions.SignedIn && a.TargetType == "UserSession" && a.TargetId == sessionId && a.Detail == null);
    }

    [Fact]
    public async Task ABrowserSessionCookieHasNoExpiryAndTheSessionLastsTwelveHours()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password, keepSignedIn: false);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);

        using var response = await AuthClient.VerifyAsync(client, code);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var raw = response.Headers.GetValues("Set-Cookie").Single(static header => header.StartsWith("__Secure-csps_rt=", StringComparison.Ordinal));
        raw.ShouldNotContain("expires=", Case.Insensitive);
        raw.ShouldNotContain("max-age=", Case.Insensitive);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var session = body.RootElement.GetProperty("session");
        session.GetProperty("persistent").GetBoolean().ShouldBeFalse();
        (session.GetProperty("sessionExpiresAt").GetDateTimeOffset() - TimeProvider.System.GetUtcNow())
            .ShouldBeInRange(TimeSpan.FromHours(11.9), TimeSpan.FromHours(12.1));
    }

    [Fact]
    public async Task ACodeWorksOnlyOnce()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);
        using var first = await AuthClient.VerifyAsync(client, code);
        first.StatusCode.ShouldBe(HttpStatusCode.OK);

        // The ticket cookie was cleared, so the second try has no ticket.
        using var second = await AuthClient.VerifyAsync(client, code);

        second.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.ticket-expired");
    }

    [Theory]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("1234567")]
    [InlineData("12 456")]
    [InlineData("abcdef")]
    public async Task AnEmptyOrIncompleteCodeGetsAFieldError(string code)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);

        using var response = await AuthClient.VerifyAsync(client, code);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("code")[0].GetString().ShouldBe("Enter all 6 digits.");
    }

    [Fact]
    public async Task AMalformedCodeDoesNotCountAsAWrongAttempt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);

        using var response = await AuthClient.VerifyAsync(client, "12345");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        await using var context = database.CreateContext();
        var codes = await context.TwoFactorCodes.AsNoTracking()
            .Where(c => context.TwoFactorChallenges.Any(ch => ch.Id == c.ChallengeId && ch.UserId == staff.Id))
            .ToListAsync(TestContext.Current.CancellationToken);
        codes.ShouldHaveSingleItem().FailedAttempts.ShouldBe(0);
    }

    [Fact]
    public async Task NoTicketCookieIsATimedOutSignIn()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.VerifyAsync(client, "123456");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("auth.ticket-expired");
        problem.GetProperty("detail").GetString().ShouldBe("Your sign-in timed out. Sign in again.");
    }

    [Fact]
    public async Task AnUnknownTicketIsATimedOutSignIn()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(AuthClient.VerifyRoute, UriKind.Relative))
        {
            Content = JsonContent.Create(new { code = "123456" }),
        };
        request.Headers.Add(AuthClient.CsrfHeader, "1");
        request.Headers.Add("Cookie", "__Secure-csps_2fa=not-a-real-ticket");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.ticket-expired");
    }

    [Fact]
    public async Task ADeactivatedAccountsTicketIsATimedOutSignIn()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);
        await AuthClient.DeactivateAsync(factory, staff.Id);

        using var response = await AuthClient.VerifyAsync(client, code);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.ticket-expired");
    }

    [Fact]
    public async Task AWrongCodeIsRefusedAndTheAttemptIsStored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);

        using var response = await AuthClient.VerifyAsync(client, AuthClient.WrongCode(code));

        await ShouldBeCodeErrorAsync(response, WrongMessage);
        (await FailedAttemptsAsync(staff.Id)).ShouldBe(1);
        await using var context = database.CreateContext();
        var userKey = staff.Id.ToString("D");
        var audits = await context.AuditLog.AsNoTracking().Where(a => a.TargetId == userKey && a.Action == AuditActions.TwoFactorFailed)
            .ToListAsync(TestContext.Current.CancellationToken);
        audits.ShouldHaveSingleItem().Detail.ShouldBeNull();
    }

    [Fact]
    public async Task FiveWrongCodesUseTheCodeUpEvenForTheRightOne()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);
        var wrong = AuthClient.WrongCode(code);

        for (var i = 0; i < 4; i++)
        {
            using var attempt = await AuthClient.VerifyAsync(client, wrong);
            await ShouldBeCodeErrorAsync(attempt, WrongMessage);
        }

        using var fifth = await AuthClient.VerifyAsync(client, wrong);
        await ShouldBeCodeErrorAsync(fifth, UsedUpMessage);
        using var right = await AuthClient.VerifyAsync(client, code);
        await ShouldBeCodeErrorAsync(right, UsedUpMessage);
        await using var context = database.CreateContext();
        var userKey = staff.Id.ToString("D");
        (await context.AuditLog.AsNoTracking().CountAsync(a => a.TargetId == userKey && a.Action == AuditActions.TwoFactorExhausted, TestContext.Current.CancellationToken))
            .ShouldBeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task AnExpiredCodeSaysSo()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);
        clock.Advance(TimeSpan.FromMinutes(16));

        using var response = await AuthClient.VerifyAsync(client, code);

        await ShouldBeCodeErrorAsync(response, ExpiredMessage);
    }

    [Fact]
    public async Task AnotherUsersCodeNeverVerifiesAgainstThisTicket()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var clientA = AuthClient.CreateClient(factory);
        using var clientB = AuthClient.CreateClient(factory);
        var a = await AuthClient.CreateStaffAsync(factory);
        var b = await AuthClient.CreateStaffAsync(factory);
        using var signInA = await AuthClient.SignInAsync(clientA, a.Email, a.Password);
        using var signInB = await AuthClient.SignInAsync(clientB, b.Email, b.Password);
        var codeOfB = await AuthClient.ReadCodeAsync(clientB, b.Email);

        using var response = await AuthClient.VerifyAsync(clientA, codeOfB);

        await ShouldBeCodeErrorAsync(response, WrongMessage);
        (await FailedAttemptsAsync(a.Id)).ShouldBe(1);
        (await FailedAttemptsAsync(b.Id)).ShouldBe(0);
    }

    [Fact]
    public async Task ACodeFromASupersededSignInNeverVerifies()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var first = AuthClient.CreateClient(factory);
        using var second = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signInFirst = await AuthClient.SignInAsync(first, staff.Email, staff.Password);
        var firstCode = await AuthClient.ReadCodeAsync(first, staff.Email);
        using var signInSecond = await AuthClient.SignInAsync(second, staff.Email, staff.Password);

        using var onNewTicket = await AuthClient.VerifyAsync(second, firstCode);
        using var onOldTicket = await AuthClient.VerifyAsync(first, firstCode);

        await ShouldBeCodeErrorAsync(onNewTicket, WrongMessage);
        onOldTicket.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await onOldTicket.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.ticket-expired");
    }

    [Theory]
    [InlineData(PasswordChangeReason.Temporary, "temporary")]
    [InlineData(PasswordChangeReason.Breach, "breach")]
    public async Task AMustChangeAccountGetsTheHandOffAndNoSession(PasswordChangeReason reason, string expected)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.RequirePasswordChangeAsync(factory, staff.Id, reason);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);

        using var response = await AuthClient.VerifyAsync(client, code);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        body.RootElement.GetProperty("next").GetString().ShouldBe("set-new-password");
        body.RootElement.GetProperty("reason").GetString().ShouldBe(expected);
        (body.RootElement.TryGetProperty("session", out var session) ? session.ValueKind : JsonValueKind.Null).ShouldBe(JsonValueKind.Null);
        response.Headers.Contains("Set-Cookie").ShouldBeFalse();
        await using var context = database.CreateContext();
        (await context.UserSessions.AsNoTracking().CountAsync(s => s.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
        var challenge = await context.TwoFactorChallenges.AsNoTracking().SingleAsync(c => c.UserId == staff.Id, TestContext.Current.CancellationToken);
        challenge.Status.ShouldBe(TwoFactorChallengeStatus.AwaitingNewPassword);
    }

    private const string WrongMessage = "That code isn't right. Check the newest email and try again.";
    private const string UsedUpMessage = "This code can't be used anymore. Use Resend Code to get a new one.";
    private const string ExpiredMessage = "This code has expired. Use Resend Code to get a new one.";

    private async Task<int> FailedAttemptsAsync(Guid userId)
    {
        await using var context = database.CreateContext();
        return await context.TwoFactorCodes.AsNoTracking()
            .Where(c => context.TwoFactorChallenges.Any(ch => ch.Id == c.ChallengeId && ch.UserId == userId))
            .SumAsync(c => c.FailedAttempts, TestContext.Current.CancellationToken);
    }

    private static async Task ShouldBeCodeErrorAsync(HttpResponseMessage response, string message)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("code")[0].GetString().ShouldBe(message);
    }
}

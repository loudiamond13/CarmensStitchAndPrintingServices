using System.Net;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-10, AUDIT-01: a deactivated or unconfirmed account never starts a sign-in and is never counted, and every
/// refused sign-in is audited with its reason and without an email, a name, a password, a code or a ticket.
/// </summary>
public sealed class InactiveAccountTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Theory]
    [InlineData(StaffState.Deactivated)]
    [InlineData(StaffState.Unconfirmed)]
    public async Task AnInactiveAccountWithTheRightPasswordGetsNoChallengeNoEmailAndNoCount(StaffState state)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory, state);

        using var right = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        using var wrong = await AuthClient.SignInAsync(client, staff.Email, "not-" + staff.Password);

        right.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        wrong.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        right.Headers.Contains("Set-Cookie").ShouldBeFalse();
        await using var context = database.CreateContext();
        (await context.TwoFactorChallenges.AsNoTracking().CountAsync(challenge => challenge.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.EmailOutbox.AsNoTracking().CountAsync(message => message.ToAddress == staff.Email, TestContext.Current.CancellationToken)).ShouldBe(0);
        var user = await context.Users.AsNoTracking().SingleAsync(candidate => candidate.Id == staff.Id, TestContext.Current.CancellationToken);
        user.AccessFailedCount.ShouldBe(0);
        user.LockoutEnd.ShouldBeNull();
    }

    [Fact]
    public async Task ManyWrongPasswordsOnADeactivatedAccountNeverLockIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory, StaffState.Deactivated);

        for (var attempt = 1; attempt <= 6; attempt++)
        {
            (await AuthClient.SignInAsync(client, staff.Email, "not-" + staff.Password)).Dispose();
        }

        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(candidate => candidate.Id == staff.Id, TestContext.Current.CancellationToken);
        user.AccessFailedCount.ShouldBe(0);
        user.LockoutEnd.ShouldBeNull();
        (await context.EmailOutbox.AsNoTracking().CountAsync(message => message.ToAddress == staff.Email, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Theory]
    [InlineData("unknown-account", true)]
    [InlineData("bad-password", false)]
    [InlineData("locked", false)]
    [InlineData("deactivated", false)]
    [InlineData("unconfirmed", false)]
    [InlineData("no-password", false)]
    public async Task EachRefusedSignInIsAuditedWithItsReasonAndNoPersonalData(string reason, bool noTarget)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var (email, password, userId) = await ArrangeAsync(factory, reason);

        using var response = await AuthClient.SignInAsync(client, email, password);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var traceId = ProblemJson.TraceId(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var entries = await context.AuditLog.AsNoTracking().Where(entry => entry.CorrelationId == traceId).ToListAsync(TestContext.Current.CancellationToken);
        var entry = entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.SignInFailed);
        entry.Detail.ShouldBe(reason);
        entry.ActorUserId.ShouldBeNull();
        if (noTarget)
        {
            entry.TargetType.ShouldBeNull();
            entry.TargetId.ShouldBeNull();
        }
        else
        {
            entry.TargetType.ShouldBe("User");
            entry.TargetId.ShouldBe(userId.ToString("D"));
        }

        foreach (var text in new[] { entry.Detail, entry.TargetId, entry.TargetType }.OfType<string>())
        {
            text.ShouldNotContain("@");
            text.ShouldNotContain(password);
        }
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("locked")]
    public async Task AnAccountThatBecomesInactiveLosesItsSessionAtTheNextRefresh(string change)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        (await AuthClient.SiteSettingsStatusAsync(client, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        if (change == "deactivated")
        {
            await AuthClient.DeactivateAsync(factory, staff.Id);
        }
        else
        {
            await AuthClient.LockAsync(factory, staff.Id);
        }

        using var response = await AuthClient.RefreshAsync(client);

        await RefreshEndpointTests.ShouldBeSessionEndedAsync(response);
        await using var context = database.CreateContext();
        var session = await context.UserSessions.AsNoTracking().SingleAsync(s => s.Id == device.SessionId, TestContext.Current.CancellationToken);
        session.RevokedAt.ShouldNotBeNull();
        session.RevokedReason.ShouldBe(SessionRevocationReason.AccountInactive);
        (await AuthClient.SiteSettingsStatusAsync(client, device.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        var sessionKey = device.SessionId.ToString("D");
        var audit = await context.AuditLog.AsNoTracking().SingleAsync(
            entry => entry.TargetId == sessionKey && entry.Action == AuditActions.SessionRevoked, TestContext.Current.CancellationToken);
        audit.TargetType.ShouldBe("UserSession");
        audit.Detail.ShouldBeNull();
    }

    [Fact]
    public async Task TheCookieOfAnInactiveAccountsEndedSessionIsRefusedAgain()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        await AuthClient.DeactivateAsync(factory, staff.Id);
        using var refused = await AuthClient.RefreshAsync(client);
        refused.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        using var again = await AuthClient.RefreshAsync(client, device.RefreshToken);

        await RefreshEndpointTests.ShouldBeSessionEndedAsync(again);
    }

    [Fact]
    public async Task ALinkOfAnAccountDeactivatedAfterwardsReadsAsInvalidAndNeverReactivatesIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var token = await AuthClient.RequestResetTokenAsync(client, staff.Email);
        await AuthClient.DeactivateAsync(factory, staff.Id);
        string hashBefore;
        await using (var before = database.CreateContext())
        {
            hashBefore = (await before.Users.AsNoTracking().SingleAsync(u => u.Id == staff.Id, TestContext.Current.CancellationToken)).PasswordHash.ShouldNotBeNull();
        }

        using var check = await AuthClient.CheckResetLinkAsync(client, token);
        using var reset = await AuthClient.ResetPasswordAsync(client, token, "Tela-Sukat-7381");

        foreach (var response in new[] { check, reset })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("auth.link-invalid");
            response.Headers.Contains("Set-Cookie").ShouldBeFalse();
        }

        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(u => u.Id == staff.Id, TestContext.Current.CancellationToken);
        user.IsActive.ShouldBeFalse();
        user.PasswordHash.ShouldBe(hashBefore);
        (await context.AccountTokens.AsNoTracking().SingleAsync(t => t.UserId == staff.Id, TestContext.Current.CancellationToken)).UsedAt.ShouldBeNull();
        (await context.UserSessions.AsNoTracking().CountAsync(s => s.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, "Tela-Sukat-7381");
        signIn.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // Builds the account for a reason and returns the credentials to try.
    private static async Task<(string Email, string Password, Guid UserId)> ArrangeAsync(CspsApiFactory factory, string reason)
    {
        if (reason == "unknown-account")
        {
            return (AuthClient.NewEmail(), "some-password", Guid.Empty);
        }

        var state = reason switch
        {
            "deactivated" => StaffState.Deactivated,
            "unconfirmed" => StaffState.Unconfirmed,
            "no-password" => StaffState.NoPassword,
            _ => StaffState.Active,
        };
        var staff = await AuthClient.CreateStaffAsync(factory, state);
        if (reason == "locked")
        {
            await AuthClient.LockAsync(factory, staff.Id);
        }

        return (staff.Email, reason == "bad-password" ? "not-" + staff.Password : staff.Password, staff.Id);
    }
}

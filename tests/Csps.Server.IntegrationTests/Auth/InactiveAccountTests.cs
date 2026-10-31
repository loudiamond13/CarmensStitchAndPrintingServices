using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    public async Task AManagerLockedOrDeletedAccountGetsTheGenericErrorNoSessionAndOneAuditedReason(string reason)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        if (reason == "manager-locked")
        {
            await AccountStateFixtures.ManagerLockAsync(factory, staff.Id);
        }
        else
        {
            await AccountStateFixtures.MarkDeletedAsync(factory, staff.Id);
        }

        using var response = await AuthClient.SignInAsync(client, staff.Email, staff.Password);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        response.Headers.Contains("Set-Cookie").ShouldBeFalse();
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("detail").GetString().ShouldBe("Email or password is incorrect.");
        await using var context = database.CreateContext();
        var entry = (await context.AuditLog.AsNoTracking()
            .Where(candidate => candidate.CorrelationId == ProblemJson.TraceId(problem))
            .ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.SignInFailed);
        entry.Detail.ShouldBe(reason);
        entry.TargetType.ShouldBe("User");
        entry.TargetId.ShouldBe(staff.Id.ToString("D"));
        entry.ActorUserId.ShouldBeNull();
        (await context.TwoFactorChallenges.AsNoTracking().CountAsync(challenge => challenge.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.EmailOutbox.AsNoTracking().CountAsync(message => message.ToAddress == staff.Email, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnActiveAccountStillStartsASignIn()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);

        using var response = await AuthClient.SignInAsync(client, staff.Email, staff.Password);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData(DeactivatedBlock)]
    [InlineData(ManagerLockedBlock)]
    [InlineData(DeletedBlock)]
    public async Task ABlockedAccountLosesItsSessionAtTheNextRefresh(string block)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        (await AuthClient.SiteSettingsStatusAsync(client, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        await ApplyBlockAsync(factory, staff.Id, block);

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

    [Theory]
    [InlineData(DeactivatedBlock)]
    [InlineData(ManagerLockedBlock)]
    [InlineData(DeletedBlock)]
    public async Task ABlockedAccountCannotFinishTheCodeStep(string block)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        signIn.StatusCode.ShouldBe(HttpStatusCode.OK);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);
        await ApplyBlockAsync(factory, staff.Id, block);

        using var response = await AuthClient.VerifyAsync(client, code);

        await ShouldBeTicketExpiredAsync(response);
        await ShouldHaveNoSessionAndOnlyTheSignInEmailAsync(staff);
    }

    [Theory]
    [InlineData(DeactivatedBlock)]
    [InlineData(ManagerLockedBlock)]
    [InlineData(DeletedBlock)]
    public async Task ABlockedAccountCannotAskForAnotherCode(string block)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        signIn.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await AuthClient.WaitForEmailsAsync(client, staff.Email)).Count.ShouldBe(1);
        await ApplyBlockAsync(factory, staff.Id, block);

        using var response = await AuthClient.ResendAsync(client);

        await ShouldBeTicketExpiredAsync(response);
        await ShouldHaveNoSessionAndOnlyTheSignInEmailAsync(staff);
    }

    [Theory]
    [InlineData(DeactivatedBlock)]
    [InlineData(ManagerLockedBlock)]
    [InlineData(DeletedBlock)]
    public async Task ABlockedAccountCannotCheckOrSetANewPassword(string block)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, "Tela-Sukat-7381", PasswordChangeReason.Temporary);
        using var verify = await AuthClient.SignInThroughCodeAsync(client, staff);
        verify.StatusCode.ShouldBe(HttpStatusCode.OK);
        await ApplyBlockAsync(factory, staff.Id, block);

        using var check = await AuthClient.CheckSetNewPasswordAsync(client);
        using var set = await AuthClient.SetNewPasswordAsync(client, "Mabuhay#Tahi2026");

        await ShouldBeTicketExpiredAsync(check);
        await ShouldBeTicketExpiredAsync(set);
        await using var context = database.CreateContext();
        (await context.UserSessions.AsNoTracking().CountAsync(s => s.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AuditLog.AsNoTracking().AnyAsync(
            a => a.Action == AuditActions.PasswordChanged && a.TargetId == staff.Id.ToString("D"), TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    [Theory]
    [InlineData(DeactivatedBlock)]
    [InlineData(ManagerLockedBlock)]
    [InlineData(DeletedBlock)]
    public async Task ABlockedInvitedAccountsLinkIsTheSameInvalidInvite404(string block)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var created = await client.PostAsJsonAsync(
            new Uri("/api/testing/staff", UriKind.Relative), new { role = "Manager", state = "invited" }, TestContext.Current.CancellationToken);
        created.StatusCode.ShouldBe(HttpStatusCode.Created);
        using var document = JsonDocument.Parse(await created.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var userId = document.RootElement.GetProperty("userId").GetGuid();
        var token = document.RootElement.GetProperty("inviteToken").GetString().ShouldNotBeNull();
        await ApplyBlockAsync(factory, userId, block);

        using var check = await AuthClient.CheckInviteAsync(client, token);
        using var accept = await AuthClient.AcceptInviteAsync(client, token, "Mabuhay#Tahi2026");

        foreach (var response in new[] { check, accept })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("auth.invite-invalid");
        }

        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().SingleAsync(u => u.Id == userId, TestContext.Current.CancellationToken)).PasswordHash.ShouldBeNull();
    }

    [Fact]
    public async Task ATemporaryLockRefusesTheRefreshButKeepsTheSession()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        await AuthClient.LockAsync(factory, staff.Id);

        using var response = await AuthClient.RefreshAsync(client);

        await RefreshEndpointTests.ShouldBeSessionEndedAsync(response);
        await using var context = database.CreateContext();
        var session = await context.UserSessions.AsNoTracking().SingleAsync(s => s.Id == device.SessionId, TestContext.Current.CancellationToken);
        session.RevokedAt.ShouldBeNull();
        session.RevokedReason.ShouldBeNull();
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

    private const string DeactivatedBlock = "deactivated";
    private const string ManagerLockedBlock = "manager-locked";
    private const string DeletedBlock = "deleted";

    // Applies one of the three blocks that IsBlocked covers.
    private static Task ApplyBlockAsync(CspsApiFactory factory, Guid id, string block) => block switch
    {
        ManagerLockedBlock => AccountStateFixtures.ManagerLockAsync(factory, id),
        DeletedBlock => AccountStateFixtures.MarkDeletedAsync(factory, id),
        _ => AuthClient.DeactivateAsync(factory, id),
    };

    private static async Task ShouldBeTicketExpiredAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.ticket-expired");
        response.Headers.Contains("Set-Cookie").ShouldBeFalse();
    }

    // Nothing was issued: no session, and the only email is the sign-in code sent before the block.
    private async Task ShouldHaveNoSessionAndOnlyTheSignInEmailAsync(TestStaff staff)
    {
        await using var context = database.CreateContext();
        (await context.UserSessions.AsNoTracking().CountAsync(s => s.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.EmailOutbox.AsNoTracking().CountAsync(message => message.ToAddress == staff.Email, TestContext.Current.CancellationToken)).ShouldBe(1);
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

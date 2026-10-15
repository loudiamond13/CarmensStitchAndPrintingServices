using System.Net;
using System.Text.Json;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-08, AUTH-09, AUTH-10, AUTH-11, D-14, D-17, D-18, D-19: a reset link is checked, sets a new password under the
/// full rule, ends every session and never signs anyone in.
/// </summary>
public sealed class PasswordResetTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string NewPassword = "Tela-Sukat-7381";

    [Fact]
    public async Task AnEmailedLinkIsCheckedSetsANewPasswordAndOnlyTheNewOneSignsInThroughTheCodeStep()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var token = await AuthClient.RequestResetTokenAsync(client, staff.Email);

        using var check = await AuthClient.CheckResetLinkAsync(client, token);
        check.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var checkBody = JsonDocument.Parse(await check.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        checkBody.RootElement.GetProperty("email").GetString().ShouldBe(staff.Email);

        using var reset = await AuthClient.ResetPasswordAsync(client, token, NewPassword);

        reset.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await reset.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
        reset.Headers.Contains("Set-Cookie").ShouldBeFalse();

        var changed = (await AuthClient.WaitForEmailsAsync(client, staff.Email, 2))[^1];
        changed.Subject.ShouldBe("Your CSPS password was changed");

        using var oldPassword = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        oldPassword.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        var signedIn = await AuthClient.SignInFullyAsync(client, staff with { Password = NewPassword }, signInsSoFar: 2);
        signedIn.UserId.ShouldBe(staff.Id);

        await using var context = database.CreateContext();
        var audit = (await context.AuditLog.AsNoTracking()
            .Where(a => a.Action == AuditActions.PasswordResetCompleted && a.TargetId == staff.Id.ToString("D"))
            .ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        audit.TargetType.ShouldBe("User");
    }

    [Fact]
    public async Task ASpentLinkNeverWorksAgainNotEvenInsideItsThirtyMinutes()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var token = await AuthClient.RequestResetTokenAsync(client, staff.Email);
        using (var first = await AuthClient.ResetPasswordAsync(client, token, NewPassword))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var second = await AuthClient.ResetPasswordAsync(client, token, "Another-Pass-9021");
        using var check = await AuthClient.CheckResetLinkAsync(client, token);

        await AssertInvalidLinkAsync(second);
        await AssertInvalidLinkAsync(check);
        await using var context = database.CreateContext();
        var row = await context.AccountTokens.AsNoTracking().SingleAsync(t => t.UserId == staff.Id, TestContext.Current.CancellationToken);
        row.UsedAt.ShouldNotBeNull();
    }

    [Fact]
    public async Task ALinkWorksUntilTheLastMomentAndIsInvalidAtExactlyThirtyMinutes()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var token = await AuthClient.RequestResetTokenAsync(client, staff.Email);

        clock.Advance(TimeSpan.FromMinutes(30) - TimeSpan.FromMilliseconds(1));
        using (var justInTime = await AuthClient.CheckResetLinkAsync(client, token))
        {
            justInTime.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        clock.Advance(TimeSpan.FromMilliseconds(1));
        using var expiredCheck = await AuthClient.CheckResetLinkAsync(client, token);
        using var expiredReset = await AuthClient.ResetPasswordAsync(client, token, NewPassword);

        await AssertInvalidLinkAsync(expiredCheck);
        await AssertInvalidLinkAsync(expiredReset);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-token")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public async Task AMalformedMissingOrUnknownTokenGetsTheSameInvalidAnswerAndIsAudited(string? token)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var check = await AuthClient.CheckResetLinkAsync(client, token);
        using var reset = await AuthClient.ResetPasswordAsync(client, token, NewPassword);

        var checkProblem = await AssertInvalidLinkAsync(check);
        var resetProblem = await AssertInvalidLinkAsync(reset);
        resetProblem.GetProperty("detail").GetString().ShouldBe(checkProblem.GetProperty("detail").GetString());
        await using var context = database.CreateContext();
        foreach (var problem in new[] { checkProblem, resetProblem })
        {
            var traceId = ProblemJson.TraceId(problem);
            var entry = (await context.AuditLog.AsNoTracking().Where(a => a.CorrelationId == traceId).ToListAsync(TestContext.Current.CancellationToken))
                .ShouldHaveSingleItem();
            entry.Action.ShouldBe(AuditActions.PasswordResetLinkInvalid);
            entry.TargetType.ShouldBeNull();
            entry.TargetId.ShouldBeNull();
            entry.Detail.ShouldBeNull();
        }
    }

    [Fact]
    public async Task AMissingPasswordIs400AndTheLinkStaysUsable()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var token = await AuthClient.RequestResetTokenAsync(client, staff.Email);

        using var reset = await AuthClient.ResetPasswordAsync(client, token, null);

        reset.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(reset, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("newPassword")[0].GetString().ShouldBe("Enter a new password.");
        using var check = await AuthClient.CheckResetLinkAsync(client, token);
        check.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("Paolo#2026x", "Don't use your name or email in your password.")]
    [InlineData("short1!", "Use at least 8 characters.")]
    [InlineData("Pwned#Pass2026", "This password has appeared in a data breach. Choose a different one.")]
    public async Task ARefusedPasswordIs400OnNewPasswordAndTheLinkIsNotSpent(string password, string message)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var token = await AuthClient.RequestResetTokenAsync(client, staff.Email);

        using var reset = await AuthClient.ResetPasswordAsync(client, token, password);

        reset.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(reset, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("newPassword").EnumerateArray().Select(m => m.GetString()).ShouldBe([message]);
        using var check = await AuthClient.CheckResetLinkAsync(client, token);
        check.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var oldStillWorks = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        oldStillWorks.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task WhenTheBreachServiceIsDownAnUncommonPasswordIsAcceptedAndMarkedForARecheck()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var token = await AuthClient.RequestResetTokenAsync(client, staff.Email);

        using var reset = await AuthClient.ResetPasswordAsync(client, token, "Hibp-Down#2026");

        reset.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().SingleAsync(u => u.Id == staff.Id, TestContext.Current.CancellationToken)).BreachRecheckPending.ShouldBeTrue();
        var audit = await context.AuditLog.AsNoTracking()
            .Where(a => a.Action == AuditActions.BreachCheckUnavailable && a.TargetId == staff.Id.ToString("D"))
            .ToListAsync(TestContext.Current.CancellationToken);
        audit.ShouldHaveSingleItem().TargetType.ShouldBe("User");
    }

    [Fact]
    public async Task AResetEndsEverySessionAtOnceAndAuditsIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var phone = AuthClient.CreateClient(factory);
        using var laptop = AuthClient.CreateClient(factory);
        using var mailbox = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var onPhone = await AuthClient.SignInFullyAsync(phone, staff);
        var onLaptop = await AuthClient.SignInFullyAsync(laptop, staff, signInsSoFar: 1);
        (await AuthClient.SiteSettingsStatusAsync(phone, onPhone.AccessToken)).ShouldBe(HttpStatusCode.OK);
        var token = await AuthClient.RequestResetTokenAsync(mailbox, staff.Email, emailsSoFar: 2);

        using var reset = await AuthClient.ResetPasswordAsync(mailbox, token, NewPassword);

        reset.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await AuthClient.SiteSettingsStatusAsync(phone, onPhone.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        (await AuthClient.SiteSettingsStatusAsync(laptop, onLaptop.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        using var phoneRefresh = await AuthClient.RefreshAsync(phone);
        using var laptopRefresh = await AuthClient.RefreshAsync(laptop);
        phoneRefresh.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        laptopRefresh.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        await using var context = database.CreateContext();
        var sessions = await context.UserSessions.AsNoTracking().Where(s => s.UserId == staff.Id).ToListAsync(TestContext.Current.CancellationToken);
        sessions.Count.ShouldBe(2);
        sessions.ShouldAllBe(s => s.RevokedAt != null && s.RevokedReason == SessionRevocationReason.PasswordReset);
        var revoked = (await context.AuditLog.AsNoTracking()
            .Where(a => a.Action == AuditActions.SessionsRevoked && a.TargetId == staff.Id.ToString("D"))
            .ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        revoked.Detail.ShouldBe("password-reset");
        revoked.TargetType.ShouldBe("User");
    }

    [Fact]
    public async Task ALockedAccountMayResetAndSignsInRightAway()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.LockAsync(factory, staff.Id);
        var token = await AuthClient.RequestResetTokenAsync(client, staff.Email);

        using var reset = await AuthClient.ResetPasswordAsync(client, token, NewPassword);

        reset.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using (var context = database.CreateContext())
        {
            var user = await context.Users.AsNoTracking().SingleAsync(u => u.Id == staff.Id, TestContext.Current.CancellationToken);
            user.LockoutEnd.ShouldBeNull();
            user.AccessFailedCount.ShouldBe(0);
        }

        var device = await AuthClient.SignInFullyAsync(client, staff with { Password = NewPassword }, signInsSoFar: 2);
        device.UserId.ShouldBe(staff.Id);
    }

    [Fact]
    public async Task AResetClearsTheMustChangeFlag()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.RequirePasswordChangeAsync(factory, staff.Id, PasswordChangeReason.Temporary);
        var token = await AuthClient.RequestResetTokenAsync(client, staff.Email);

        using var reset = await AuthClient.ResetPasswordAsync(client, token, NewPassword);

        reset.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(u => u.Id == staff.Id, TestContext.Current.CancellationToken);
        user.MustChangePassword.ShouldBeFalse();
        user.MustChangePasswordReason.ShouldBeNull();
        user.BreachRecheckPending.ShouldBeFalse();
    }

    [Fact]
    public async Task TwoResetsWithTheSameLinkAtTheSameMomentLetExactlyOneThrough()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var first = AuthClient.CreateClient(factory);
        using var second = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var token = await AuthClient.RequestResetTokenAsync(first, staff.Email);

        var responses = await Task.WhenAll(
            AuthClient.ResetPasswordAsync(first, token, "First-Choice-4417"),
            AuthClient.ResetPasswordAsync(second, token, "Second-Choice-5528"));

        try
        {
            responses.Count(r => r.StatusCode == HttpStatusCode.NoContent).ShouldBe(1);
            responses.Count(r => r.StatusCode == HttpStatusCode.NotFound).ShouldBe(1);
        }
        finally
        {
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }
    }

    private static async Task<JsonElement> AssertInvalidLinkAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("auth.link-invalid");
        problem.GetProperty("detail").GetString().ShouldBe("This link has expired");
        return problem;
    }
}

using System.Net;
using System.Text.Json;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-02, AUTH-09, AUTH-11, D-13, D-21, D-22: an account flagged "must set a new password" signs in with its password
/// and emailed code, holds no session until a valid new password is saved, and is signed in by that save.
/// </summary>
public sealed class MustChangePasswordTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string TemporaryPassword = "Tela-Sukat-7381";
    private const string NewPassword = "Mabuhay#Tahi2026";

    [Fact]
    public async Task ATemporaryPasswordNeedsTheCodeThenANewPasswordAndOnlyThenASession()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, TemporaryPassword, PasswordChangeReason.Temporary);

        using var verify = await AuthClient.SignInThroughCodeAsync(client, staff);

        verify.StatusCode.ShouldBe(HttpStatusCode.OK);
        using (var verified = JsonDocument.Parse(await verify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)))
        {
            verified.RootElement.GetProperty("next").GetString().ShouldBe("set-new-password");
            verified.RootElement.GetProperty("reason").GetString().ShouldBe("temporary");
            (verified.RootElement.TryGetProperty("session", out var none) ? none.ValueKind : JsonValueKind.Null).ShouldBe(JsonValueKind.Null);
        }

        verify.Headers.Contains("Set-Cookie").ShouldBeFalse();
        using (var denied = await client.GetAsync(new Uri("/api/v1/site-settings", UriKind.Relative), TestContext.Current.CancellationToken))
        {
            denied.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        using var saved = await AuthClient.SetNewPasswordAsync(client, NewPassword);

        saved.StatusCode.ShouldBe(HttpStatusCode.OK);
        var device = await AuthClient.ReadDeviceAsync(saved, staff.Id);
        device.RefreshToken.ShouldNotBeNullOrEmpty();
        saved.Headers.GetValues("Set-Cookie").ShouldContain(header => header.StartsWith("__Secure-csps_2fa=;", StringComparison.Ordinal));
        (await AuthClient.SiteSettingsStatusAsync(client, device.AccessToken)).ShouldBe(HttpStatusCode.OK);

        var emails = await AuthClient.WaitForEmailsAsync(client, staff.Email, 2);
        emails[^1].Subject.ShouldBe("Your CSPS password was changed");
        emails[^1].Text.ShouldNotContain("signed out");

        await using var context = database.CreateContext();
        var id = staff.Id.ToString("D");
        var changed = await context.AuditLog.AsNoTracking()
            .Where(a => a.Action == AuditActions.PasswordChanged && a.TargetId == id)
            .ToListAsync(TestContext.Current.CancellationToken);
        changed.ShouldHaveSingleItem().TargetType.ShouldBe("User");
        var signedIn = await context.AuditLog.AsNoTracking()
            .Where(a => a.Action == AuditActions.SignedIn && a.TargetId == device.SessionId.ToString("D"))
            .ToListAsync(TestContext.Current.CancellationToken);
        signedIn.ShouldHaveSingleItem().TargetType.ShouldBe("UserSession");

        using var later = AuthClient.CreateClient(factory);
        using var laterVerify = await AuthClient.SignInThroughCodeAsync(later, staff with { Password = NewPassword }, signInsSoFar: 2);
        using var laterBody = JsonDocument.Parse(await laterVerify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        laterBody.RootElement.GetProperty("next").GetString().ShouldBe("signed-in");
    }

    [Fact]
    public async Task WithoutATicketTheAnswerIs401AndNothingChanges()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, TemporaryPassword, PasswordChangeReason.Temporary);

        using var response = await AuthClient.SetNewPasswordAsync(client, NewPassword);

        await ShouldBeTicketExpiredAsync(response);
        await ShouldStillHoldTemporaryPasswordAsync(factory, staff);
    }

    [Fact]
    public async Task ASignInThatHasNotPassedTheCodeStepCannotSetAPassword()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, TemporaryPassword, PasswordChangeReason.Temporary);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        signIn.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var response = await AuthClient.SetNewPasswordAsync(client, NewPassword);

        await ShouldBeTicketExpiredAsync(response);
        await ShouldStillHoldTemporaryPasswordAsync(factory, staff);
    }

    [Fact]
    public async Task TheTicketWorksOnceAndAReplayIs401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, TemporaryPassword, PasswordChangeReason.Temporary);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        var ticket = AuthClient.TicketOf(signIn);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);
        using var verify = await AuthClient.VerifyAsync(client, code);
        verify.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var first = await AuthClient.SetNewPasswordAsync(client, NewPassword);
        first.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var other = AuthClient.CreateClient(factory);
        using var replay = await AuthClient.SetNewPasswordAsync(other, "Another#Mabuhay2026", ticket: ticket);

        await ShouldBeTicketExpiredAsync(replay);
        await using var context = database.CreateContext();
        (await context.UserSessions.AsNoTracking().CountAsync(s => s.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task ARefusedPasswordKeepsTheStepOpenAndTheTemporaryOneIsAcceptedAsAnyOtherValidPassword()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, TemporaryPassword, PasswordChangeReason.Temporary);
        using var verify = await AuthClient.SignInThroughCodeAsync(client, staff);
        verify.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var breached = await AuthClient.SetNewPasswordAsync(client, "Pwned#Pass2026");

        breached.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(breached, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("newPassword")[0].GetString()
            .ShouldBe("This password has appeared in a data breach. Choose a different one.");
        breached.Headers.Contains("Set-Cookie").ShouldBeFalse();

        using var same = await AuthClient.SetNewPasswordAsync(client, TemporaryPassword);

        same.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.UserSessions.AsNoTracking().CountAsync(s => s.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task AnAccountDeactivatedAfterTheCodeStepCannotSetAPassword()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, TemporaryPassword, PasswordChangeReason.Temporary);
        using var verify = await AuthClient.SignInThroughCodeAsync(client, staff);
        verify.StatusCode.ShouldBe(HttpStatusCode.OK);
        await AuthClient.DeactivateAsync(factory, staff.Id);

        using var response = await AuthClient.SetNewPasswordAsync(client, NewPassword);

        await ShouldBeTicketExpiredAsync(response);
    }

    [Fact]
    public async Task TheStepNeedsTheAntiCsrfHeader()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, TemporaryPassword, PasswordChangeReason.Temporary);
        using var verify = await AuthClient.SignInThroughCodeAsync(client, staff);
        verify.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var response = await AuthClient.SetNewPasswordAsync(client, NewPassword, csrf: false);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private static async Task ShouldBeTicketExpiredAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.ticket-expired");
        response.Headers.Contains("Set-Cookie").ShouldBeFalse();
    }

    // The temporary password still signs in and no session exists: nothing was saved.
    private async Task ShouldStillHoldTemporaryPasswordAsync(CspsApiFactory factory, TestStaff staff)
    {
        await using var context = database.CreateContext();
        (await context.UserSessions.AsNoTracking().CountAsync(s => s.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AuditLog.AsNoTracking().AnyAsync(
            a => a.Action == AuditActions.PasswordChanged && a.TargetId == staff.Id.ToString("D"), TestContext.Current.CancellationToken)).ShouldBeFalse();
        using var client = AuthClient.CreateClient(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, TemporaryPassword);
        signIn.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}

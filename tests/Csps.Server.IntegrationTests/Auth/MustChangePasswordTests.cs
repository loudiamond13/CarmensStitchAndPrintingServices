using System.Net;
using System.Text.Json;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
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
}

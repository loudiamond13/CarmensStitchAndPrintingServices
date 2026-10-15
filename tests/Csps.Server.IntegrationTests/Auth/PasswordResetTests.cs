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
}

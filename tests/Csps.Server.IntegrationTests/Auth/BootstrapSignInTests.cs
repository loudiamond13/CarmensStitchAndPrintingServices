using System.Net;
using System.Text.Json;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-12, D-14, D-29: on an empty migrated database the bootstrap handler creates the first Manager and queues an
/// invite; the link sets a password under the full rule, and the Manager then signs in with the emailed code.
/// </summary>
public sealed class BootstrapSignInTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Email = "carmen@csps.test";
    private const string Password = "Mabuhay#Tahi2026";
    private const string LinkStart = "https://localhost/admin/accept-invite#token=";

    [Fact]
    public async Task AnEmptyDatabaseGetsItsFirstManagerByInviteAndTheManagerSignsInWithTheEmailedCode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        Guid id;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var handler = scope.ServiceProvider.GetRequiredService<BootstrapManagerHandler>();
            var created = await handler.HandleAsync(new BootstrapManagerCommand(Email, "Carmen", "Reyes"), TestContext.Current.CancellationToken);
            created.IsSuccess.ShouldBeTrue();
            id = created.Value;
        }

        var invite = (await AuthClient.WaitForEmailsAsync(client, Email)).ShouldHaveSingleItem();
        invite.Subject.ShouldBe("Set up your CSPS staff account");
        invite.Text.ShouldContain(LinkStart);
        var token = AuthClient.TokenOf(invite);

        using (var check = await AuthClient.CheckInviteAsync(client, token))
        {
            check.StatusCode.ShouldBe(HttpStatusCode.OK);
            using var body = JsonDocument.Parse(await check.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            body.RootElement.GetProperty("email").GetString().ShouldBe(Email);
            body.RootElement.GetProperty("firstName").GetString().ShouldBe("Carmen");
        }

        using (var accept = await AuthClient.AcceptInviteAsync(client, token, Password))
        {
            accept.StatusCode.ShouldBe(HttpStatusCode.NoContent);
            (await accept.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
            accept.Headers.Contains("Set-Cookie").ShouldBeFalse();
        }

        var staff = new TestStaff(id, Email, Password);
        using var verify = await AuthClient.SignInThroughCodeAsync(client, staff, signInsSoFar: 1);
        verify.StatusCode.ShouldBe(HttpStatusCode.OK);
        var device = await AuthClient.ReadDeviceAsync(verify, id);
        (await AuthClient.SiteSettingsStatusAsync(client, device.AccessToken)).ShouldBe(HttpStatusCode.OK);
        using (var body = JsonDocument.Parse(await verify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)))
        {
            body.RootElement.GetProperty("session").GetProperty("user").GetProperty("role").GetString().ShouldBe(Roles.Manager);
        }

        await using var context = database.CreateContext();
        var key = id.ToString("D");
        var audit = await context.AuditLog.AsNoTracking()
            .Where(a => a.TargetId == key)
            .ToListAsync(TestContext.Current.CancellationToken);
        audit.Single(a => a.Action == AuditActions.BootstrapManagerCreated).ActorUserId.ShouldBeNull();
        audit.Single(a => a.Action == AuditActions.UserInvited).ActorUserId.ShouldBeNull();
        audit.Single(a => a.Action == AuditActions.InviteAccepted).TargetType.ShouldBe("User");
    }
}

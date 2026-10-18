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

    private static string NewEmail(string name) => $"{name}.{Guid.NewGuid():N}@example.com";

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

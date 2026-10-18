using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-12, D-14, D-29: an invite works once, for 7 days, and every invite that does not work gets the same 404. The
/// breach check fails closed, and a refused password leaves the invite usable.
/// </summary>
public sealed class InviteTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Good = "Mabuhay#Tahi2026";
    private const string StaffRoute = "/api/testing/staff";

    [Theory]
    [InlineData("used")]
    [InlineData("expired")]
    [InlineData("revoked")]
    [InlineData("malformed")]
    [InlineData("unknown")]
    [InlineData("deactivated")]
    public async Task AnyInviteThatDoesNotWorkIsTheSame404ForCheckAndAccept(string reason)
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var invited = await CreateInvitedAsync(client);
        var token = await BreakAsync(reason, invited, factory, client, clock);

        using var check = await AuthClient.CheckInviteAsync(client, token);
        using var accept = await AuthClient.AcceptInviteAsync(client, token, Good);

        var checkProblem = await AssertInvalidAsync(check);
        var acceptProblem = await AssertInvalidAsync(accept);
        acceptProblem.GetProperty("detail").GetString().ShouldBe(checkProblem.GetProperty("detail").GetString());
        if (reason != "used")
        {
            await using var context = database.CreateContext();
            (await context.Users.AsNoTracking().SingleAsync(u => u.Id == invited.UserId, TestContext.Current.CancellationToken))
                .PasswordHash.ShouldBeNull();
        }
    }

    [Fact]
    public async Task AnInviteWorksUntilTheLastMomentAndIsInvalidAtExactlySevenDays()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var invited = await CreateInvitedAsync(client);

        clock.Advance(TimeSpan.FromDays(7) - TimeSpan.FromMilliseconds(1));
        using (var justInTime = await AuthClient.CheckInviteAsync(client, invited.Token))
        {
            justInTime.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        clock.Advance(TimeSpan.FromMilliseconds(1));
        using var check = await AuthClient.CheckInviteAsync(client, invited.Token);
        using var accept = await AuthClient.AcceptInviteAsync(client, invited.Token, Good);

        await AssertInvalidAsync(check);
        await AssertInvalidAsync(accept);
    }

    [Fact]
    public async Task AUsedInviteNeverWorksAgain()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var invited = await CreateInvitedAsync(client);
        using (var first = await AuthClient.AcceptInviteAsync(client, invited.Token, Good))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var second = await AuthClient.AcceptInviteAsync(client, invited.Token, "Another#Pass2026");
        using var check = await AuthClient.CheckInviteAsync(client, invited.Token);

        await AssertInvalidAsync(second);
        await AssertInvalidAsync(check);
        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(u => u.Id == invited.UserId, TestContext.Current.CancellationToken);
        user.EmailConfirmed.ShouldBeTrue();
        user.PasswordHash.ShouldNotBeNull();
    }

    [Fact]
    public async Task WhenTheBreachListCannotBeReachedNothingIsSavedAndTheInviteStaysUsable()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var invited = await CreateInvitedAsync(client);

        using var accept = await AuthClient.AcceptInviteAsync(client, invited.Token, "Hibp-Down#2026");

        accept.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(accept, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("auth.breach-check-unavailable");
        problem.GetProperty("detail").GetString().ShouldBe("We couldn't check your password right now.");
        using (var check = await AuthClient.CheckInviteAsync(client, invited.Token))
        {
            check.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(u => u.Id == invited.UserId, TestContext.Current.CancellationToken);
        user.PasswordHash.ShouldBeNull();
        user.EmailConfirmed.ShouldBeFalse();
        var id = invited.UserId.ToString("D");
        (await context.AuditLog.AsNoTracking().CountAsync(a => a.Action == AuditActions.InviteAccepted && a.TargetId == id, TestContext.Current.CancellationToken))
            .ShouldBe(0);
        (await context.AuditLog.AsNoTracking().CountAsync(a => a.Action == AuditActions.BreachCheckUnavailable && a.TargetId == id, TestContext.Current.CancellationToken))
            .ShouldBe(1);

        using var later = await AuthClient.AcceptInviteAsync(client, invited.Token, Good);
        later.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Theory]
    [InlineData("Pwned#Pass2026", "This password has appeared in a data breach. Choose a different one.")]
    [InlineData("Staff#2026xyz", "Don't use your name or email in your password.")]
    [InlineData("short1!", "Use at least 8 characters.")]
    public async Task ARefusedPasswordIs400OnNewPasswordAndTheInviteIsNotSpent(string password, string message)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var invited = await CreateInvitedAsync(client);

        using var accept = await AuthClient.AcceptInviteAsync(client, invited.Token, password);

        accept.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(accept, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("newPassword").EnumerateArray().Select(m => m.GetString()).ShouldBe([message]);
        using var check = await AuthClient.CheckInviteAsync(client, invited.Token);
        check.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AMissingPasswordIs400AndTheInviteStaysUsable()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var invited = await CreateInvitedAsync(client);

        using var accept = await AuthClient.AcceptInviteAsync(client, invited.Token, null);

        accept.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(accept, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("newPassword")[0].GetString().ShouldBe("Enter a new password.");
        using var check = await AuthClient.CheckInviteAsync(client, invited.Token);
        check.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AcceptingAnInviteIssuesNoSessionAndOnlyTheNewPasswordSignsIn()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var invited = await CreateInvitedAsync(client);

        using var accept = await AuthClient.AcceptInviteAsync(client, invited.Token, Good);

        accept.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        accept.Headers.Contains("Set-Cookie").ShouldBeFalse();
        using var wrong = await AuthClient.SignInAsync(client, invited.Email, "Another#Pass2026");
        wrong.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var device = await AuthClient.SignInFullyAsync(client, new TestStaff(invited.UserId, invited.Email, Good), signInsSoFar: 0);
        device.UserId.ShouldBe(invited.UserId);
    }

    [Fact]
    public async Task AUsableInviteCheckNamesTheEmailAndBothNames()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var invited = await CreateInvitedAsync(client);

        using var check = await AuthClient.CheckInviteAsync(client, invited.Token);

        check.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var body = JsonDocument.Parse(await check.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(u => u.Id == invited.UserId, TestContext.Current.CancellationToken);
        body.RootElement.GetProperty("email").GetString().ShouldBe(invited.Email);
        body.RootElement.GetProperty("firstName").GetString().ShouldBe(user.FirstName);
        body.RootElement.GetProperty("lastName").GetString().ShouldBe(user.LastName);
        user.LastName.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task TheInvitedFixtureStateReturnsAnAccountWithNoPasswordAndATokenThatAccepts()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        var invited = await CreateInvitedAsync(client);

        invited.Token.Length.ShouldBe(43);
        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(u => u.Id == invited.UserId, TestContext.Current.CancellationToken);
        user.Email.ShouldBe(invited.Email);
        user.IsActive.ShouldBeTrue();
        user.PasswordHash.ShouldBeNull();
        using var accept = await AuthClient.AcceptInviteAsync(client, invited.Token, Good);
        accept.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    private static async Task<Invited> CreateInvitedAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync(
            new Uri(StaffRoute, UriKind.Relative), new { role = "Manager", state = "invited" }, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var root = document.RootElement;
        return new Invited(
            root.GetProperty("userId").GetGuid(),
            root.GetProperty("email").GetString().ShouldNotBeNull(),
            root.GetProperty("inviteToken").GetString().ShouldNotBeNull());
    }

    // Makes the invite fail for one reason and returns the token to present.
    private async Task<string?> BreakAsync(
        string reason, Invited invited, Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory, HttpClient client, SteppedClock clock)
    {
        switch (reason)
        {
            case "used":
                using (var first = await AuthClient.AcceptInviteAsync(client, invited.Token, Good))
                {
                    first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
                }

                return invited.Token;
            case "expired":
                clock.Advance(TimeSpan.FromDays(8));
                return invited.Token;
            case "revoked":
                await using (var context = database.CreateContext())
                {
                    var stored = await context.AccountTokens.SingleAsync(t => t.UserId == invited.UserId, TestContext.Current.CancellationToken);
                    stored.Revoke(clock.GetUtcNow());
                    await context.SaveChangesAsync(TestContext.Current.CancellationToken);
                }

                return invited.Token;
            case "malformed":
                return "not-a-token";
            case "unknown":
                return "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
            case "deactivated":
                await AuthClient.DeactivateAsync(factory, invited.UserId);
                return invited.Token;
            default:
                throw new ArgumentOutOfRangeException(nameof(reason), reason, "Unknown reason.");
        }
    }

    private static async Task<JsonElement> AssertInvalidAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("auth.invite-invalid");
        problem.GetProperty("detail").GetString().ShouldBe("This invite has expired");
        return problem;
    }

    private sealed record Invited(Guid UserId, string Email, string Token);
}

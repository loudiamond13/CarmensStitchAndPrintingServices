using System.Net;
using System.Text;
using System.Text.Json;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-02 first step, AUTH-01, D-08, D-32: the right email and password answer with a resend wait, set the
/// pending-login cookie and queue one code email; bad bodies get field errors.
/// </summary>
public sealed class SignInEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task RightPasswordSetsTheTicketCookieAndEmailsACode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);

        using var response = await AuthClient.SignInAsync(client, staff.Email, staff.Password, keepSignedIn: true);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        using (var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)))
        {
            body.RootElement.GetProperty("resendAfterSeconds").GetInt32().ShouldBe(60);
        }

        var cookies = response.Headers.GetValues("Set-Cookie").Select(static header => SetCookieHeaderValue.Parse(header)).ToList();
        var ticket = cookies.ShouldHaveSingleItem();
        ticket.Name.Value.ShouldBe("__Secure-csps_2fa");
        ticket.HttpOnly.ShouldBeTrue();
        ticket.Secure.ShouldBeTrue();
        ticket.SameSite.ShouldBe(SameSiteMode.Strict);
        ticket.Path.Value.ShouldBe("/api/v1/auth");
        var lifetime = ticket.Expires.ShouldNotBeNull() - TimeProvider.System.GetUtcNow();
        lifetime.ShouldBeInRange(TimeSpan.FromMinutes(29), TimeSpan.FromMinutes(31));

        var mail = await AuthClient.LatestEmailAsync(client, staff.Email);
        mail.Subject.ShouldMatch(@"^\d{6} is your CSPS sign-in code$");
        mail.Text.ShouldContain("from Chrome on Android");
        (await AuthClient.ReadEmailsAsync(client, staff.Email)).ShouldHaveSingleItem();

        await using var context = database.CreateContext();
        var challenge = (await context.TwoFactorChallenges.AsNoTracking().Where(c => c.UserId == staff.Id).ToListAsync(TestContext.Current.CancellationToken))
            .ShouldHaveSingleItem();
        challenge.Persistent.ShouldBeTrue();
        var audit = await context.AuditLog.AsNoTracking()
            .Where(a => a.Action == AuditActions.TwoFactorIssued && a.TargetId == staff.Id.ToString("D"))
            .ToListAsync(TestContext.Current.CancellationToken);
        audit.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task BrowserSessionChoiceIsStoredOnTheChallenge()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);

        using var response = await AuthClient.SignInAsync(client, staff.Email, staff.Password, keepSignedIn: false);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var challenge = (await context.TwoFactorChallenges.AsNoTracking().Where(c => c.UserId == staff.Id).ToListAsync(TestContext.Current.CancellationToken))
            .ShouldHaveSingleItem();
        challenge.Persistent.ShouldBeFalse();
    }

    [Fact]
    public async Task NoRefreshCookieExistsBeforeTheCodeIsVerified()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);

        using var response = await AuthClient.SignInAsync(client, staff.Email, staff.Password);

        response.Headers.GetValues("Set-Cookie").ShouldNotContain(cookie => cookie.StartsWith("__Secure-csps_rt", StringComparison.Ordinal));
        response.Headers.Contains("Authorization").ShouldBeFalse();
    }

    [Theory]
    [InlineData("")]
    [InlineData("{}")]
    [InlineData("not json")]
    public async Task EmptyOrMalformedBodyGetsFieldErrors(string body)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var content = new StringContent(body, Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(new Uri(AuthClient.SignInRoute, UriKind.Relative), content, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        var errors = problem.GetProperty("errors");
        errors.GetProperty("email")[0].GetString().ShouldBe("Enter your email.");
        errors.GetProperty("password")[0].GetString().ShouldBe("Enter your password.");
    }

    [Theory]
    [InlineData("paolo")]
    [InlineData("@gmail.com")]
    [InlineData("paolo@")]
    [InlineData("a@b@c.com")]
    public async Task MalformedEmailGetsTheFormatMessage(string email)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.SignInAsync(client, email, "whatever-it-is");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        var errors = problem.GetProperty("errors");
        errors.GetProperty("email")[0].GetString().ShouldBe("Enter a valid email, like name@gmail.com");
        errors.TryGetProperty("password", out _).ShouldBeFalse();
    }

    [Fact]
    public async Task AnyPasswordIsAcceptedByTheValidator()
    {
        // Legacy and temporary passwords must reach the check: no length or composition rule (UI-SPEC S1).
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.SignInAsync(client, AuthClient.NewEmail(), "x");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.invalid-credentials");
    }
}

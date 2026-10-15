using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-08, D-16, D-20, D-28, D-39: forgot-password emails one fragment-only link whose token is stored only as a
/// 30-minute hash, and answers the same 202 for every address.
/// </summary>
public sealed partial class ForgotPasswordTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string LinkStart = "https://localhost/admin/reset-password#token=";

    [Fact]
    public async Task AnActiveAccountGetsOneFragmentLinkAndTheDatabaseKeepsOnlyItsHash()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);

        using var response = await AuthClient.ForgotPasswordAsync(client, staff.Email);

        response.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();

        var mail = (await AuthClient.WaitForEmailsAsync(client, staff.Email)).ShouldHaveSingleItem();
        mail.Subject.ShouldBe("Reset your CSPS password");
        mail.Text.ShouldContain(LinkStart);
        mail.Text.ShouldContain("from Chrome on Android");
        var token = TokenInLink().Match(mail.Text).Groups[1].Value;
        token.Length.ShouldBe(43);

        await using var context = database.CreateContext();
        var row = (await context.AccountTokens.AsNoTracking().Where(t => t.UserId == staff.Id).ToListAsync(TestContext.Current.CancellationToken))
            .ShouldHaveSingleItem();
        row.Purpose.ShouldBe(AccountTokenPurpose.PasswordReset);
        row.TokenHash.ShouldBe(TokenHash.Compute(token));
        row.TokenHash.ShouldNotBe(Encoding.UTF8.GetBytes(token));
        row.ExpiresAt.ShouldBe(row.CreatedAt.AddMinutes(30));
        row.UsedAt.ShouldBeNull();
        row.RevokedAt.ShouldBeNull();

        var audit = (await context.AuditLog.AsNoTracking()
            .Where(a => a.Action == AuditActions.PasswordResetRequested && a.TargetId == staff.Id.ToString("D"))
            .ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        var detail = audit.Detail.ShouldNotBeNull();
        detail.ShouldBe("sent");
        detail.ShouldNotContain(staff.Email);
        detail.ShouldNotContain(token);
    }

    [Theory]
    [InlineData("")]
    [InlineData("{}")]
    [InlineData("not json")]
    public async Task AnEmptyOrMalformedBodyGetsTheEmailFieldError(string body)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var content = new StringContent(body, Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(new Uri(AuthClient.ForgotRoute, UriKind.Relative), content, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("email")[0].GetString().ShouldBe("Enter your email.");
    }

    [Fact]
    public async Task AMalformedEmailGetsTheFormatMessage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.ForgotPasswordAsync(client, "paolo");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("email")[0].GetString().ShouldBe("Enter a valid email, like name@gmail.com");
    }

    [GeneratedRegex(@"#token=([A-Za-z0-9_-]+)")]
    private static partial Regex TokenInLink();
}

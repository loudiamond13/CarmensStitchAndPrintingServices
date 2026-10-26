using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Users;
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

        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(AuthClient.ForgotRoute, UriKind.Relative)) { Content = content };
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

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

    [Fact]
    public async Task UnknownDeactivatedAndActiveAddressesAllGetTheSame202()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var active = await AuthClient.CreateStaffAsync(factory);
        var deactivated = await AuthClient.CreateStaffAsync(factory, StaffState.Deactivated);
        var answers = new List<(HttpStatusCode Status, string Body, string? CacheControl, string? ContentType)>();

        foreach (var email in new[] { AuthClient.NewEmail(), deactivated.Email, active.Email })
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            using var response = await AuthClient.ForgotPasswordAsync(client, email);
            stopwatch.Stop();
            stopwatch.Elapsed.ShouldBeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(490));
            answers.Add((
                response.StatusCode,
                await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken),
                response.Headers.CacheControl?.ToString(),
                response.Content.Headers.ContentType?.ToString()));
        }

        answers.Distinct().ShouldHaveSingleItem().Status.ShouldBe(HttpStatusCode.Accepted);
        answers[0].Body.ShouldBeEmpty();
    }

    [Fact]
    public async Task ADeactivatedAccountGetsTheNoticeWithoutALinkOrAToken()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory, StaffState.Deactivated);

        using var response = await AuthClient.ForgotPasswordAsync(client, staff.Email);

        response.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var mail = (await AuthClient.WaitForEmailsAsync(client, staff.Email)).ShouldHaveSingleItem();
        mail.Text.ShouldContain("Your account is deactivated. Ask a Manager if you need access.");
        mail.Text.ShouldNotContain("http");
        mail.Html.ShouldNotContain("href=");
        mail.Html.ShouldNotContain("token=");
        await using var context = database.CreateContext();
        (await context.AccountTokens.AsNoTracking().CountAsync(t => t.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
        var audit = (await context.AuditLog.AsNoTracking()
            .Where(a => a.Action == AuditActions.PasswordResetRequested && a.TargetId == staff.Id.ToString("D"))
            .ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        audit.Detail.ShouldBe("deactivated");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AnUnknownOrUnconfirmedAddressGetsNoEmailAndNoToken(bool unconfirmedAccount)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var email = unconfirmedAccount ? (await AuthClient.CreateStaffAsync(factory, StaffState.Unconfirmed)).Email : AuthClient.NewEmail();

        using var response = await AuthClient.ForgotPasswordAsync(client, email);

        response.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        await using var context = database.CreateContext();
        (await context.EmailOutbox.AsNoTracking().CountAsync(m => m.ToAddress == email, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AuditLog.AsNoTracking()
            .CountAsync(a => a.Action == AuditActions.PasswordResetRequested && a.TargetId == null && a.Detail == "unknown-account", TestContext.Current.CancellationToken))
            .ShouldBeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task ATemporaryPasswordPersonGetsNothingBeforeTheFirstCorrectCodeAndTheUsualAnswerAfterTheFloor()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var email = AuthClient.NewEmail();
        var id = await UserFixtures.CreateWithTemporaryPasswordAsync(client, manager.AccessToken, email, "Tela-Sukat-7381");
        await using var context = database.CreateContext();
        var unknownBefore = await context.AuditLog.AsNoTracking()
            .CountAsync(a => a.Action == AuditActions.PasswordResetRequested && a.TargetId == null && a.Detail == "unknown-account", TestContext.Current.CancellationToken);

        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        using var response = await AuthClient.ForgotPasswordAsync(client, email);
        stopwatch.Stop();

        response.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
        stopwatch.Elapsed.ShouldBeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(490));
        (await context.EmailOutbox.AsNoTracking().CountAsync(m => m.ToAddress == email, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AccountTokens.AsNoTracking().CountAsync(t => t.UserId == id, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AuditLog.AsNoTracking()
            .CountAsync(a => a.Action == AuditActions.PasswordResetRequested && a.TargetId == null && a.Detail == "unknown-account", TestContext.Current.CancellationToken))
            .ShouldBe(unknownBefore + 1);
        (await context.AuditLog.AsNoTracking()
            .CountAsync(a => a.Action == AuditActions.PasswordResetRequested && a.TargetId == id.ToString("D"), TestContext.Current.CancellationToken))
            .ShouldBe(0);
    }

    [Fact]
    public async Task OnlyThreeLinkEmailsAreSentPerHourAndTheNewestLinkIsTheOnlyLiveOne()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);

        for (var request = 0; request < 4; request++)
        {
            using var response = await AuthClient.ForgotPasswordAsync(client, staff.Email);
            response.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        }

        var mails = await AuthClient.WaitForEmailsAsync(client, staff.Email, count: 3);
        mails.Count.ShouldBe(3);
        await using var context = database.CreateContext();
        var rows = await context.AccountTokens.AsNoTracking().Where(t => t.UserId == staff.Id).OrderBy(t => t.CreatedAt).ToListAsync(TestContext.Current.CancellationToken);
        rows.Count.ShouldBe(3);
        rows.Count(row => row.RevokedAt is null).ShouldBe(1);
        rows[^1].RevokedAt.ShouldBeNull();
        var newest = TokenInLink().Match(mails[^1].Text).Groups[1].Value;
        rows[^1].TokenHash.ShouldBe(TokenHash.Compute(newest));
        var details = await context.AuditLog.AsNoTracking()
            .Where(a => a.Action == AuditActions.PasswordResetRequested && a.TargetId == staff.Id.ToString("D"))
            .OrderBy(a => a.Id)
            .Select(a => a.Detail)
            .ToListAsync(TestContext.Current.CancellationToken);
        details.ShouldBe(["sent", "sent", "sent", "capped"]);
    }

    [Fact]
    public async Task OnlyThreeDeactivatedNoticesAreSentPerHour()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory, StaffState.Deactivated);

        for (var request = 0; request < 4; request++)
        {
            using var response = await AuthClient.ForgotPasswordAsync(client, staff.Email);
            response.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        }

        (await AuthClient.WaitForEmailsAsync(client, staff.Email, count: 3)).Count.ShouldBe(3);
        await using var context = database.CreateContext();
        (await context.EmailOutbox.AsNoTracking().CountAsync(m => m.ToAddress == staff.Email, TestContext.Current.CancellationToken)).ShouldBe(3);
    }

    [Fact]
    public async Task TwoRequestsAtTheSameMomentLeaveExactlyOneUsableToken()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var first = AuthClient.CreateClient(factory);
        using var second = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);

        var responses = await Task.WhenAll(
            AuthClient.ForgotPasswordAsync(first, staff.Email),
            AuthClient.ForgotPasswordAsync(second, staff.Email));

        foreach (var response in responses)
        {
            response.StatusCode.ShouldBe(HttpStatusCode.Accepted);
            response.Dispose();
        }

        await using var context = database.CreateContext();
        var rows = await context.AccountTokens.AsNoTracking().Where(t => t.UserId == staff.Id).ToListAsync(TestContext.Current.CancellationToken);
        rows.Count.ShouldBe(2);
        rows.Count(row => row.IsUsable(TimeProvider.System.GetUtcNow())).ShouldBe(1);
        rows.Count(row => row.RevokedAt is not null).ShouldBe(1);
    }

    [Fact]
    public async Task TwoRequestsForTheSamePersonAtTheSameMomentLeaveOneUsableLinkEveryRound()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var first = AuthClient.CreateClient(factory);
        using var second = AuthClient.CreateClient(factory);

        for (var round = 0; round < 10; round++)
        {
            var staff = await AuthClient.CreateStaffAsync(factory);

            var (one, two) = await ConcurrentRequests.SendTogetherAsync(
                () => AuthClient.ForgotPasswordAsync(first, staff.Email),
                () => AuthClient.ForgotPasswordAsync(second, staff.Email));
            using (one)
            using (two)
            {
                one.StatusCode.ShouldBe(HttpStatusCode.Accepted);
                two.StatusCode.ShouldBe(HttpStatusCode.Accepted);
            }

            await using var context = database.CreateContext();
            var rows = await context.AccountTokens.AsNoTracking().Where(t => t.UserId == staff.Id).ToListAsync(TestContext.Current.CancellationToken);
            rows.Count.ShouldBe(2, $"round {round}");
            rows.Count(row => row.IsUsable(TimeProvider.System.GetUtcNow())).ShouldBe(1, $"round {round}");
            rows.Count(row => row.RevokedAt is not null).ShouldBe(1, $"round {round}");
        }
    }

    [GeneratedRegex(@"#token=([A-Za-z0-9_-]+)")]
    private static partial Regex TokenInLink();
}

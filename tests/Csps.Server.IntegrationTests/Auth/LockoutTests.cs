using System.Net;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-07, D-25, AUDIT-01: the fifth wrong password locks the account for 15 minutes, queues exactly one plain
/// email that links to the forgot-password page, and writes one lockout audit entry. A locked account changes nothing.
/// </summary>
public sealed class LockoutTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string LockedSubject = "Your CSPS account is locked for 15 minutes";

    [Fact]
    public async Task TheFifthWrongPasswordLocksTheAccountAndSendsOneEmail()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);

        for (var attempt = 1; attempt <= 4; attempt++)
        {
            await WrongAsync(client, staff);
        }

        (await LockedMailCountAsync(staff.Email)).ShouldBe(0);

        var fifthTraceId = await WrongAsync(client, staff);

        var mail = (await AuthClient.WaitForEmailsAsync(client, staff.Email)).ShouldHaveSingleItem();
        mail.Subject.ShouldBe(LockedSubject);
        mail.Text.ShouldContain("https://localhost/admin/forgot-password");
        mail.Text.ShouldNotContain("token");
        mail.Html.ShouldContain("https://localhost/admin/forgot-password");
        mail.Html.ShouldNotContain("token");

        await using var context = database.CreateContext();
        var lockout = (await context.AuditLog.AsNoTracking()
            .Where(entry => entry.Action == AuditActions.Lockout && entry.TargetId == staff.Id.ToString("D"))
            .ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        lockout.Detail.ShouldBe("password");
        lockout.TargetType.ShouldBe("User");
        lockout.CorrelationId.ShouldBe(fifthTraceId);
        var user = await context.Users.AsNoTracking().SingleAsync(candidate => candidate.Id == staff.Id, TestContext.Current.CancellationToken);
        user.LockoutEnd.ShouldNotBeNull().ShouldBeInRange(
            TimeProvider.System.GetUtcNow().AddMinutes(14), TimeProvider.System.GetUtcNow().AddMinutes(16));
    }

    [Fact]
    public async Task ALockedAccountChangesNothingAndSendsNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            await WrongAsync(client, staff);
        }

        await WrongAsync(client, staff);
        using var right = await AuthClient.SignInAsync(client, staff.Email, staff.Password);

        right.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        right.Headers.Contains("Set-Cookie").ShouldBeFalse();
        (await LockedMailCountAsync(staff.Email)).ShouldBe(1);
        await using var context = database.CreateContext();
        (await context.EmailOutbox.AsNoTracking().CountAsync(message => message.ToAddress == staff.Email, TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.TwoFactorChallenges.AsNoTracking().CountAsync(challenge => challenge.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
        var user = await context.Users.AsNoTracking().SingleAsync(candidate => candidate.Id == staff.Id, TestContext.Current.CancellationToken);
        user.AccessFailedCount.ShouldBe(0);
        (await context.AuditLog.AsNoTracking()
            .CountAsync(entry => entry.Action == AuditActions.Lockout && entry.TargetId == staff.Id.ToString("D"), TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task TheRightPasswordWorksAgainWhenTheLockoutHasEnded()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            await WrongAsync(client, staff);
        }

        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            await scope.ServiceProvider.GetRequiredService<IUserAccounts>()
                .LockUntilAsync(staff.Id, TimeProvider.System.GetUtcNow().AddMinutes(-1), TestContext.Current.CancellationToken);
        }

        using var response = await AuthClient.SignInAsync(client, staff.Email, staff.Password);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var codeMail = (await AuthClient.WaitForEmailsAsync(client, staff.Email, count: 2))[^1];
        codeMail.Subject.ShouldMatch(@"^\d{6} is your CSPS sign-in code$");
    }

    [Fact]
    public async Task ARightPasswordResetsTheFailedCount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            await WrongAsync(client, staff);
        }

        using (var right = await AuthClient.SignInAsync(client, staff.Email, staff.Password))
        {
            right.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        await WrongAsync(client, staff);

        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(candidate => candidate.Id == staff.Id, TestContext.Current.CancellationToken);
        user.AccessFailedCount.ShouldBe(1);
        user.LockoutEnd.ShouldBeNull();
    }

    private static async Task<string> WrongAsync(HttpClient client, TestStaff staff)
    {
        using var response = await AuthClient.SignInAsync(client, staff.Email, "not-" + staff.Password);
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        return ProblemJson.TraceId(problem);
    }

    private async Task<int> LockedMailCountAsync(string email)
    {
        await using var context = database.CreateContext();
        return await context.EmailOutbox.AsNoTracking()
            .CountAsync(message => message.ToAddress == email && message.Kind == AuthEmailKind.AccountLocked, TestContext.Current.CancellationToken);
    }
}

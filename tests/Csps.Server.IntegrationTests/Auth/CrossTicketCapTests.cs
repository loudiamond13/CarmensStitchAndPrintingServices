using System.Net;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>AUTH-03, D-39, T-04-46: wrong codes are capped per account across sign-ins, not only per code.</summary>
public sealed class CrossTicketCapTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task TenWrongCodesAcrossTwoSignInsLockTheAccount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var first = AuthClient.CreateClient(factory);
        using var second = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);

        using var signInFirst = await AuthClient.SignInAsync(first, staff.Email, staff.Password);
        var firstCode = await AuthClient.ReadCodeAsync(first, staff.Email);
        await WrongCodesAsync(first, AuthClient.WrongCode(firstCode), 5, expectLast: HttpStatusCode.BadRequest);

        // The second sign-in cancels the first challenge, but its five wrong codes still count.
        using var signInSecond = await AuthClient.SignInAsync(second, staff.Email, staff.Password);
        var secondCode = await AuthClient.ReadCodeAsync(second, staff.Email, count: 2);
        var wrong = AuthClient.WrongCode(secondCode);
        await WrongCodesAsync(second, wrong, 4, expectLast: HttpStatusCode.BadRequest);

        using var tenth = await AuthClient.VerifyAsync(second, wrong);

        tenth.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        tenth.Headers.RetryAfter.ShouldBeNull();
        var problem = await ProblemJson.ReadAsync(tenth, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("auth.code-lockout");
        problem.GetProperty("detail").GetString().ShouldBe("Too many wrong codes.");

        var lockout = await AuthClient.WaitForEmailsAsync(second, staff.Email, count: 3);
        lockout.Count(static mail => !mail.Subject.EndsWith("is your CSPS sign-in code", StringComparison.Ordinal)).ShouldBe(1);

        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(u => u.Id == staff.Id, TestContext.Current.CancellationToken);
        user.LockoutEnd.ShouldNotBeNull().ShouldBeInRange(TimeProvider.System.GetUtcNow().AddMinutes(14), TimeProvider.System.GetUtcNow().AddMinutes(16));
        var open = await context.TwoFactorChallenges.AsNoTracking()
            .CountAsync(c => c.UserId == staff.Id && c.Status == Csps.Domain.Identity.TwoFactorChallengeStatus.Pending, TestContext.Current.CancellationToken);
        open.ShouldBe(0);
        var userKey = staff.Id.ToString("D");
        var lockouts = await context.AuditLog.AsNoTracking().Where(a => a.TargetId == userKey && a.Action == AuditActions.Lockout).ToListAsync(TestContext.Current.CancellationToken);
        lockouts.ShouldHaveSingleItem().Detail.ShouldBe("code");

        // Locked: the right password now gets the one generic answer, and the right code is a timed-out sign-in.
        using var signInAgain = await AuthClient.SignInAsync(first, staff.Email, staff.Password);
        signInAgain.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await signInAgain.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.invalid-credentials");
        using var rightCode = await AuthClient.VerifyAsync(second, secondCode);
        rightCode.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task NineWrongCodesDoNotLockTheAccount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var first = AuthClient.CreateClient(factory);
        using var second = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signInFirst = await AuthClient.SignInAsync(first, staff.Email, staff.Password);
        var firstCode = await AuthClient.ReadCodeAsync(first, staff.Email);
        await WrongCodesAsync(first, AuthClient.WrongCode(firstCode), 5, expectLast: HttpStatusCode.BadRequest);
        using var signInSecond = await AuthClient.SignInAsync(second, staff.Email, staff.Password);
        var secondCode = await AuthClient.ReadCodeAsync(second, staff.Email, count: 2);
        await WrongCodesAsync(second, AuthClient.WrongCode(secondCode), 4, expectLast: HttpStatusCode.BadRequest);

        using var right = await AuthClient.VerifyAsync(second, secondCode);

        right.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task WrongCodesOfOneAccountNeverLockAnother()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var clientA = AuthClient.CreateClient(factory);
        using var clientB = AuthClient.CreateClient(factory);
        var a = await AuthClient.CreateStaffAsync(factory);
        var b = await AuthClient.CreateStaffAsync(factory);
        using var signInA = await AuthClient.SignInAsync(clientA, a.Email, a.Password);
        var codeA = await AuthClient.ReadCodeAsync(clientA, a.Email);
        await WrongCodesAsync(clientA, AuthClient.WrongCode(codeA), 5, expectLast: HttpStatusCode.BadRequest);

        using var signInB = await AuthClient.SignInAsync(clientB, b.Email, b.Password);
        var codeB = await AuthClient.ReadCodeAsync(clientB, b.Email);
        using var response = await AuthClient.VerifyAsync(clientB, codeB);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    private static async Task WrongCodesAsync(HttpClient client, string wrong, int count, HttpStatusCode expectLast)
    {
        for (var i = 0; i < count; i++)
        {
            using var response = await AuthClient.VerifyAsync(client, wrong);
            response.StatusCode.ShouldBe(i == count - 1 ? expectLast : HttpStatusCode.BadRequest);
        }
    }
}

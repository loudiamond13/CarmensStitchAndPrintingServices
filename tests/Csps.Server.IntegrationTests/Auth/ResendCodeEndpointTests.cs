using System.Net;
using System.Text.Json;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>AUTH-04, D-10, T-04-48: resend waits a minute, stops at five codes an hour without a wait time, and only the newest code works.</summary>
public sealed class ResendCodeEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task ResendWaitsAMinuteThenSendsANewCodeAndOnlyTheNewestWorks()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        var firstCode = await AuthClient.ReadCodeAsync(client, staff.Email);

        clock.Advance(TimeSpan.FromSeconds(30));
        using var tooSoon = await AuthClient.ResendAsync(client);

        tooSoon.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        tooSoon.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldBe(TimeSpan.FromSeconds(30));
        var problem = await ProblemJson.ReadAsync(tooSoon, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("auth.resend-cooldown");

        clock.Advance(TimeSpan.FromSeconds(31));
        using var resent = await AuthClient.ResendAsync(client);

        resent.StatusCode.ShouldBe(HttpStatusCode.OK);
        resent.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        using (var body = JsonDocument.Parse(await resent.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)))
        {
            body.RootElement.GetProperty("resendAfterSeconds").GetInt32().ShouldBe(60);
        }

        var secondCode = await AuthClient.ReadCodeAsync(client, staff.Email, count: 2);
        secondCode.ShouldNotBe(firstCode);
        (await AuthClient.ReadEmailsAsync(client, staff.Email)).Count.ShouldBe(2);

        using var oldCode = await AuthClient.VerifyAsync(client, firstCode);
        oldCode.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(oldCode, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("code")[0].GetString()
            .ShouldBe("That code isn't right. Check the newest email and try again.");
        using var newCode = await AuthClient.VerifyAsync(client, secondCode);
        newCode.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var verified = JsonDocument.Parse(await newCode.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        verified.RootElement.GetProperty("next").GetString().ShouldBe("signed-in");

        await using var context = database.CreateContext();
        var userKey = staff.Id.ToString("D");
        var resends = await context.AuditLog.AsNoTracking().Where(a => a.TargetId == userKey && a.Action == AuditActions.TwoFactorResent)
            .ToListAsync(TestContext.Current.CancellationToken);
        resends.ShouldHaveSingleItem().Detail.ShouldBeNull();
    }

    [Fact]
    public async Task TheSixthCodeInAnHourIsRefusedWithNoWaitTime()
    {
        var clock = new SteppedClock();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);

        // The sign-in sent the first code; four resends make five.
        for (var sent = 2; sent <= 5; sent++)
        {
            clock.Advance(TimeSpan.FromSeconds(61));
            using var resend = await AuthClient.ResendAsync(client);
            resend.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        clock.Advance(TimeSpan.FromSeconds(61));
        using var capped = await AuthClient.ResendAsync(client);

        capped.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        capped.Headers.Contains("Retry-After").ShouldBeFalse();
        var problem = await ProblemJson.ReadAsync(capped, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("auth.resend-cap");
        problem.GetProperty("detail").GetString().ShouldBe("You've asked for too many codes.");
        (await AuthClient.ReadEmailsAsync(client, staff.Email)).Count.ShouldBe(5);
    }

    [Fact]
    public async Task ResendWithoutTheHeaderIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);

        using var response = await AuthClient.ResendAsync(client, csrf: false);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.csrf-check-failed");
        (await AuthClient.ReadEmailsAsync(client, staff.Email)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task ResendWithNoTicketIsATimedOutSignIn()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.ResendAsync(client);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("auth.ticket-expired");
    }

    [Fact]
    public async Task ResendAfterTheCodeWasUsedIsATimedOutSignIn()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        using var signIn = await AuthClient.SignInAsync(client, staff.Email, staff.Password);
        var code = await AuthClient.ReadCodeAsync(client, staff.Email);
        using var verified = await AuthClient.VerifyAsync(client, code);
        verified.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var response = await AuthClient.ResendAsync(client);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}

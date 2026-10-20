using System.Net;
using System.Security.Cryptography;
using System.Text;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Identity;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Csps.Server.IntegrationTests.Idempotency;

/// <summary>
/// SEC-06, D-40: a covered POST repeated with the same Idempotency-Key and body gets the first answer back and does
/// not run again. The key, route and user decide what a repeat is; the record commits with the business change.
/// </summary>
public sealed class IdempotencyTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string ForgotRoute = "POST /api/v1/auth/password/forgot";
    private const string ProbePrefix = "/api/test/idempotency";
    private const string ProbeStatusRoute = "POST /api/test/idempotency/status/{code:int}";
    private const string ProbeStatusPath = "/api/test/idempotency/status/200";
    private const string KeyMissingText = "This form needs a fresh request key. Reload and try again.";

    [Fact]
    public async Task ARepeatedForgotPostQueuesOneEmailAndGetsTheFirstAnswerBack()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var key = Guid.NewGuid();

        using var first = await AuthClient.ForgotPasswordAsync(client, staff.Email, idempotencyKey: key);
        using var second = await AuthClient.ForgotPasswordAsync(client, staff.Email, idempotencyKey: key);

        first.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        first.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        second.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        second.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");

        (await AuthClient.WaitForEmailsAsync(client, staff.Email)).ShouldHaveSingleItem();
        await using var context = database.CreateContext();
        (await context.EmailOutbox.CountAsync(m => m.ToAddress == staff.Email, TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.AccountTokens.CountAsync(t => t.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(1);

        var record = (await ReadRecordsAsync(key)).ShouldHaveSingleItem();
        record.StatusCode.ShouldBe(202);
        record.UserId.ShouldBeNull();
        record.Route.ShouldBe(ForgotRoute);
        record.RequestHashLength.ShouldBe(32);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-uuid")]
    [InlineData("{6f1d3c52-8a0e-4b7d-9c41-2e5a7b9d0f13}")]
    public async Task AMissingOrMalformedKeyIsRefusedBeforeTheHandlerRuns(string? rawKey)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);

        using var response = await SendAsync(client, AuthClient.ForgotRoute, rawKey, $$"""{"email":"{{staff.Email}}"}""");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("idempotency.key-missing");
        problem.GetProperty("detail").GetString().ShouldBe(KeyMissingText);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();

        await using var context = database.CreateContext();
        (await context.EmailOutbox.CountAsync(m => m.ToAddress == staff.Email, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.AccountTokens.CountAsync(t => t.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TwoKeyHeadersAreRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(AuthClient.ForgotRoute, UriKind.Relative))
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        };
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, [Guid.NewGuid().ToString("D"), Guid.NewGuid().ToString("D")]);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("idempotency.key-missing");
    }

    [Fact]
    public async Task TheSameKeyWithADifferentBodyIsRefusedAndNothingNewIsStored()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var first = await AuthClient.CreateStaffAsync(factory);
        var other = await AuthClient.CreateStaffAsync(factory);
        var key = Guid.NewGuid();

        using var accepted = await AuthClient.ForgotPasswordAsync(client, first.Email, idempotencyKey: key);
        using var refused = await AuthClient.ForgotPasswordAsync(client, other.Email, idempotencyKey: key);

        accepted.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        refused.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        refused.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        (await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("idempotency.key-mismatch");

        (await ReadRecordsAsync(key)).ShouldHaveSingleItem().StatusCode.ShouldBe(202);
        await using var context = database.CreateContext();
        (await context.AccountTokens.CountAsync(t => t.UserId == other.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AnEmptyBodyIsHashedLikeAnyOtherBody()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var key = Guid.NewGuid();

        using var first = await SendAsync(client, $"{ProbePrefix}/echo", key.ToString("D"), body: null);
        using var repeat = await SendAsync(client, $"{ProbePrefix}/echo", key.ToString("D"), body: null);
        using var other = await SendAsync(client, $"{ProbePrefix}/echo", key.ToString("D"), body: "{}");

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        repeat.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");
        other.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        probe.Runs.ShouldBe(1);
    }

    [Fact]
    public async Task TheSameKeyOnAnotherResourceOfTheSameRoutePatternIsAMismatchNotAReplay()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var key = Guid.NewGuid().ToString("D");

        using var first = await SendAsync(client, $"{ProbePrefix}/status/200", key, body: null);
        using var otherResource = await SendAsync(client, $"{ProbePrefix}/status/202", key, body: null);
        using var otherQuery = await SendAsync(client, $"{ProbePrefix}/status/200?write={Guid.NewGuid():D}", key, body: null);
        using var repeat = await SendAsync(client, $"{ProbePrefix}/status/200", key, body: null);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        otherResource.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        otherResource.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        (await ProblemJson.ReadAsync(otherResource, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("idempotency.key-mismatch");
        otherQuery.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        repeat.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");
        probe.Runs.ShouldBe(1);
    }

    [Fact]
    public async Task AFrameworkBodyTooLargeFailureIsA413NotA500()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();

        using var response = await SendAsync(client, $"{ProbePrefix}/too-large", Guid.NewGuid().ToString("D"));

        response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("title").GetString().ShouldBe("The request is too large.");
    }

    [Fact]
    public async Task AChunkedBodyOverOneMebibyteIsA413AndNeverRuns()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Post, $"{ProbePrefix}/echo", null);
        request.Headers.TryAddWithoutValidation(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        request.Headers.TransferEncodingChunked = true;
        request.Content = new StreamContent(new MemoryStream(new byte[1_048_576 + 1]));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
        probe.Runs.ShouldBe(0);
    }

    [Fact]
    public async Task ADuplicateThatArrivesWhileTheFirstRunsGetsAConflict()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var key = Guid.NewGuid();

        // The forgot handler waits out its 500 ms floor inside the transaction, so the two overlap.
        var both = await Task.WhenAll(
            AuthClient.ForgotPasswordAsync(client, staff.Email, idempotencyKey: key),
            AuthClient.ForgotPasswordAsync(client, staff.Email, idempotencyKey: key));
        try
        {
            both.Select(static response => (int)response.StatusCode).Order().ShouldBe([202, 409]);
            var conflict = both.Single(static response => response.StatusCode == HttpStatusCode.Conflict);
            (await ProblemJson.ReadAsync(conflict, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("idempotency.in-progress");
        }
        finally
        {
            foreach (var response in both)
            {
                response.Dispose();
            }
        }

        // Once the first has committed, the same key replays its answer and no second email goes out.
        using var later = await AuthClient.ForgotPasswordAsync(client, staff.Email, idempotencyKey: key);
        later.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        later.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");
        (await AuthClient.WaitForEmailsAsync(client, staff.Email)).ShouldHaveSingleItem();
        await using var context = database.CreateContext();
        (await context.EmailOutbox.CountAsync(m => m.ToAddress == staff.Email, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task AnInputErrorIsStoredAndReplayed()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var key = Guid.NewGuid();

        using var first = await AuthClient.ForgotPasswordAsync(client, string.Empty, idempotencyKey: key);
        using var repeat = await AuthClient.ForgotPasswordAsync(client, string.Empty, idempotencyKey: key);

        first.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        repeat.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        repeat.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");
        repeat.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe(ProblemJson.MediaType);
        (await repeat.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))
            .ShouldBe(await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await ReadRecordsAsync(key)).ShouldHaveSingleItem().StatusCode.ShouldBe(400);
    }

    [Fact]
    public async Task ANotFoundFromResetIsStoredAndTheSameKeyOnAnotherRouteRunsAsNew()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var key = Guid.NewGuid();
        var badLink = new string('a', 43);

        using var forgot = await AuthClient.ForgotPasswordAsync(client, staff.Email, idempotencyKey: key);
        using var reset = await AuthClient.ResetPasswordAsync(client, badLink, "A-long-new-Password-1!", key);
        using var repeat = await AuthClient.ResetPasswordAsync(client, badLink, "A-long-new-Password-1!", key);

        forgot.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        reset.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        reset.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        repeat.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        repeat.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");
        (await ReadRecordsAsync(key)).Select(static record => record.Route).Order().ShouldBe(
            ["POST /api/v1/auth/password/forgot", "POST /api/v1/auth/password/reset"]);
    }

    [Theory]
    [InlineData(200)]
    [InlineData(201)]
    [InlineData(202)]
    [InlineData(400)]
    [InlineData(404)]
    [InlineData(422)]
    public async Task SuccessesAndInputErrorsAreStoredAndReplayedWithoutRunningAgain(int status)
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var key = Guid.NewGuid().ToString("D");

        using var first = await SendAsync(client, $"{ProbePrefix}/status/{status}", key);
        using var repeat = await SendAsync(client, $"{ProbePrefix}/status/{status}", key);

        ((int)first.StatusCode).ShouldBe(status);
        ((int)repeat.StatusCode).ShouldBe(status);
        first.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        repeat.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");
        repeat.Headers.Location.ShouldBe(first.Headers.Location);
        repeat.Content.Headers.ContentType?.MediaType.ShouldBe(first.Content.Headers.ContentType?.MediaType);
        (await repeat.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))
            .ShouldBe(await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        probe.Runs.ShouldBe(1);
        if (status == 201)
        {
            repeat.Headers.Location.ShouldNotBeNull().ToString().ShouldBe("/api/test/idempotency/items/7");
        }
    }

    [Theory]
    [InlineData(401)]
    [InlineData(403)]
    [InlineData(409)]
    [InlineData(429)]
    [InlineData(500)]
    [InlineData(503)]
    public async Task AnswersThatMayWorkOnRetryAreNotStoredAndTheSameKeyRunsAgain(int status)
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var key = Guid.NewGuid();

        using var first = await SendAsync(client, $"{ProbePrefix}/status/{status}", key.ToString("D"));
        using var again = await SendAsync(client, $"{ProbePrefix}/status/{status}", key.ToString("D"));

        ((int)first.StatusCode).ShouldBe(status);
        ((int)again.StatusCode).ShouldBe(status);
        again.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        probe.Runs.ShouldBe(2);
        (await ReadRecordsAsync(key)).ShouldBeEmpty();
    }

    [Fact]
    public async Task TheStoredRecordAndTheBusinessRowCommitTogetherOrNotAtAll()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var keptRow = Guid.NewGuid();
        var lostRow = Guid.NewGuid();

        using var kept = await SendAsync(client, $"{ProbePrefix}/status/422?write={keptRow:D}", Guid.NewGuid().ToString("D"));
        using var lost = await SendAsync(client, $"{ProbePrefix}/status/429?write={lostRow:D}", Guid.NewGuid().ToString("D"));

        kept.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        lost.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        (await ReadRecordsAsync(keptRow)).ShouldHaveSingleItem();
        (await ReadRecordsAsync(lostRow)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnEndpointCanKeepItsChangeWhenTheAnswerIsNotStored()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var key = Guid.NewGuid();
        var keptRow = Guid.NewGuid();

        using var first = await SendAsync(client, $"{ProbePrefix}/keep/429?write={keptRow:D}", key.ToString("D"));

        first.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        (await ReadRecordsAsync(keptRow)).ShouldHaveSingleItem();
        (await ReadRecordsAsync(key)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AKeptChangeStoresNoAnswerSoTheSameKeyRunsAgain()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var key = Guid.NewGuid();

        using var first = await SendAsync(client, $"{ProbePrefix}/keep/429?write={Guid.NewGuid():D}", key.ToString("D"));
        using var again = await SendAsync(client, $"{ProbePrefix}/keep/429?write={Guid.NewGuid():D}", key.ToString("D"));

        first.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        again.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        again.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        probe.Runs.ShouldBe(2);
    }

    [Fact]
    public async Task AThrownExceptionRollsBackAndTheSameKeyRunsAgain()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var key = Guid.NewGuid();

        using var first = await SendAsync(client, $"{ProbePrefix}/throw", key.ToString("D"));
        using var again = await SendAsync(client, $"{ProbePrefix}/throw", key.ToString("D"));

        first.StatusCode.ShouldBe(HttpStatusCode.InternalServerError);
        again.StatusCode.ShouldBe(HttpStatusCode.InternalServerError);
        again.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        probe.Runs.ShouldBe(2);
        (await ReadRecordsAsync(key)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnAnswerThatSetsACookieIsNeverStored()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var key = Guid.NewGuid();

        using var first = await SendAsync(client, $"{ProbePrefix}/cookie", key.ToString("D"));
        using var again = await SendAsync(client, $"{ProbePrefix}/cookie", key.ToString("D"));

        first.Headers.Contains("Set-Cookie").ShouldBeTrue();
        again.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        probe.Runs.ShouldBe(2);
        (await ReadRecordsAsync(key)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AResponseOverOneMegabyteReachesTheClientButIsNotStored()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var key = Guid.NewGuid();

        using var first = await SendAsync(client, $"{ProbePrefix}/big", key.ToString("D"));
        using var again = await SendAsync(client, $"{ProbePrefix}/big", key.ToString("D"));

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await first.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Length.ShouldBe(1_200_000);
        (await again.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Length.ShouldBe(1_200_000);
        again.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        probe.Runs.ShouldBe(2);
        (await ReadRecordsAsync(key)).ShouldBeEmpty();
    }

    [Fact]
    public async Task TheSameKeyFromADifferentUserIsADifferentRequest()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var manager = await TestSessions.StartAsync(host.Root, "Manager");
        var admin = await TestSessions.StartAsync(host.Root, "Admin");
        var key = Guid.NewGuid();
        var route = $"{ProbePrefix}/status/200";

        using var anonymous = await SendAsync(client, route, key.ToString("D"));
        using var asManager = await SendAsync(client, route, key.ToString("D"), bearer: manager.AccessToken);
        using var asAdmin = await SendAsync(client, route, key.ToString("D"), bearer: admin.AccessToken);
        using var managerAgain = await SendAsync(client, route, key.ToString("D"), bearer: manager.AccessToken);
        using var anonymousAgain = await SendAsync(client, route, key.ToString("D"));

        foreach (var first in new[] { anonymous, asManager, asAdmin })
        {
            first.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        }

        managerAgain.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeTrue();
        anonymousAgain.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeTrue();
        probe.Runs.ShouldBe(3);
        (await ReadRecordsAsync(key)).Select(static record => record.UserId).ShouldBe(
            [null, manager.UserId, admin.UserId], ignoreOrder: true);
    }

    [Fact]
    public async Task AKeyOlderThan24HoursIsReplacedAndTheHandlerRunsAgain()
    {
        var probe = new IdempotencyProbe();
        var clock = new SteppedClock();
        await using var host = ProbeHost(probe, clock);
        using var client = host.Factory.CreateClient();
        var key = Guid.NewGuid();
        var route = $"{ProbePrefix}/status/200";

        using var first = await SendAsync(client, route, key.ToString("D"));
        clock.Advance(TimeSpan.FromHours(24) - TimeSpan.FromSeconds(1));
        using var stillKept = await SendAsync(client, route, key.ToString("D"));
        clock.Advance(TimeSpan.FromSeconds(2));
        using var expired = await SendAsync(client, route, key.ToString("D"));
        using var replayedNew = await SendAsync(client, route, key.ToString("D"));

        first.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        stillKept.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeTrue();
        expired.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        replayedNew.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeTrue();
        probe.Runs.ShouldBe(2);
        (await ReadRecordsAsync(key)).ShouldHaveSingleItem();
    }

    [Fact]
    public async Task TheStoredHashIsAKeyedHmacThatChangesWithTheKey()
    {
        var otherKey = Convert.ToBase64String(SHA384.HashData(Encoding.UTF8.GetBytes("another code key")));
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        await using var otherHost = ProbeHost(new IdempotencyProbe(), codeMacKey: otherKey);
        using var client = host.Factory.CreateClient();
        using var otherClient = otherHost.Factory.CreateClient();
        var key = Guid.NewGuid();
        var otherRecordKey = Guid.NewGuid();

        using var stored = await SendAsync(client, ProbeStatusPath, key.ToString("D"));
        using var storedElsewhere = await SendAsync(otherClient, ProbeStatusPath, otherRecordKey.ToString("D"));

        stored.StatusCode.ShouldBe(HttpStatusCode.OK);
        storedElsewhere.StatusCode.ShouldBe(HttpStatusCode.OK);
        var hash = (await ReadRecordsAsync(key)).ShouldHaveSingleItem().RequestHash;
        var otherHash = (await ReadRecordsAsync(otherRecordKey)).ShouldHaveSingleItem().RequestHash;
        hash.Length.ShouldBe(32);
        otherHash.Length.ShouldBe(32);
        hash.ShouldNotBe(otherHash);
        hash.ShouldBe(KeyedHash(TestSecrets.CodeMacKeyBase64, ProbeStatusPath, "{}"));
        otherHash.ShouldBe(KeyedHash(otherKey, ProbeStatusPath, "{}"));
        hash.ShouldNotBe(PlainHash(ProbeStatusPath, "{}"));
    }

    [Fact]
    public async Task ARecordStoredBeforeTheKeyedHashIsAMismatchAndNeverRunsAgain()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var key = Guid.NewGuid();
        var oldHash = PlainHash(ProbeStatusPath, "{}");
        await StoreAsync(IdempotencyRecord.Create(key, null, ProbeStatusRoute, oldHash, 200, """{"runs":1}""", "application/json", null, TimeProvider.System.GetUtcNow()));

        using var retry = await SendAsync(client, ProbeStatusPath, key.ToString("D"));

        retry.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        retry.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        (await ProblemJson.ReadAsync(retry, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("idempotency.key-mismatch");
        probe.Runs.ShouldBe(0);
        var record = (await ReadRecordsAsync(key)).ShouldHaveSingleItem();
        record.RequestHash.ShouldBe(oldHash);
        record.StatusCode.ShouldBe(200);
    }

    [Fact]
    public async Task ARetryAfterTheCodeKeyChangedIsAMismatchAndNeverRunsAgain()
    {
        var otherKey = Convert.ToBase64String(SHA384.HashData(Encoding.UTF8.GetBytes("rotated code key")));
        var probe = new IdempotencyProbe();
        var rotatedProbe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        await using var rotatedHost = ProbeHost(rotatedProbe, codeMacKey: otherKey);
        using var client = host.Factory.CreateClient();
        using var rotatedClient = rotatedHost.Factory.CreateClient();
        var key = Guid.NewGuid().ToString("D");

        using var first = await SendAsync(client, ProbeStatusPath, key);
        using var retry = await SendAsync(rotatedClient, ProbeStatusPath, key);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        retry.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(retry, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("idempotency.key-mismatch");
        probe.Runs.ShouldBe(1);
        rotatedProbe.Runs.ShouldBe(0);
    }

    [Fact]
    public async Task ExpiredRecordsOfAnyKeyRouteOrUserAreDeletedByTheNextCoveredPost()
    {
        var probe = new IdempotencyProbe();
        var clock = new SteppedClock();
        await using var host = ProbeHost(probe, clock);
        using var client = host.Factory.CreateClient();
        var manager = await TestSessions.StartAsync(host.Root, "Manager");
        var anonymousKey = Guid.NewGuid();
        var otherRouteKey = Guid.NewGuid();
        var managerKey = Guid.NewGuid();
        var freshKey = Guid.NewGuid();

        using var anonymous = await SendAsync(client, ProbeStatusPath, anonymousKey.ToString("D"));
        using var otherRoute = await SendAsync(client, $"{ProbePrefix}/status/202", otherRouteKey.ToString("D"));
        using var asManager = await SendAsync(client, ProbeStatusPath, managerKey.ToString("D"), bearer: manager.AccessToken);
        clock.Advance(TimeSpan.FromHours(24) + TimeSpan.FromSeconds(1));
        using var fresh = await SendAsync(client, ProbeStatusPath, freshKey.ToString("D"));

        fresh.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadRecordsAsync(anonymousKey)).ShouldBeEmpty();
        (await ReadRecordsAsync(otherRouteKey)).ShouldBeEmpty();
        (await ReadRecordsAsync(managerKey)).ShouldBeEmpty();
        (await ReadRecordsAsync(freshKey)).ShouldHaveSingleItem();
    }

    [Fact]
    public async Task OneRequestDeletesAtMostOneBatch()
    {
        var probe = new IdempotencyProbe();
        await using var host = ProbeHost(probe);
        using var client = host.Factory.CreateClient();
        var route = $"POST /probe/purge-batch/{Guid.NewGuid():N}";
        var stale = TimeProvider.System.GetUtcNow() - TimeSpan.FromHours(25);
        await using (var context = database.CreateContext())
        {
            for (var index = 0; index < IdempotencyGate.PurgeBatchSize + 5; index++)
            {
                context.Add(IdempotencyRecord.Create(Guid.NewGuid(), null, route, new byte[32], 200, null, null, null, stale));
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        using var first = await SendAsync(client, ProbeStatusPath, Guid.NewGuid().ToString("D"));
        var afterFirst = await CountRecordsAsync(route);
        using var second = await SendAsync(client, ProbeStatusPath, Guid.NewGuid().ToString("D"));
        var afterSecond = await CountRecordsAsync(route);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        afterFirst.ShouldBe(5);
        afterSecond.ShouldBe(0);
    }

    [Fact]
    public async Task AnUnexpiredRecordIsNeverDeleted()
    {
        var probe = new IdempotencyProbe();
        var clock = new SteppedClock();
        await using var host = ProbeHost(probe, clock);
        using var client = host.Factory.CreateClient();
        var keptKey = Guid.NewGuid().ToString("D");

        using var first = await SendAsync(client, ProbeStatusPath, keptKey);
        clock.Advance(TimeSpan.FromHours(23) + TimeSpan.FromMinutes(59));
        using var other = await SendAsync(client, ProbeStatusPath, Guid.NewGuid().ToString("D"));
        using var repeat = await SendAsync(client, ProbeStatusPath, keptKey);

        other.StatusCode.ShouldBe(HttpStatusCode.OK);
        repeat.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");
        probe.Runs.ShouldBe(2);
        (await ReadRecordsAsync(Guid.Parse(keptKey))).ShouldHaveSingleItem();
    }

    private static async Task<HttpResponseMessage> SendAsync(HttpClient client, string path, string? rawKey, string? body = "{}", string? bearer = null)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, path, bearer);
        if (rawKey is not null)
        {
            request.Headers.TryAddWithoutValidation(AuthClient.IdempotencyKeyHeader, rawKey);
        }

        if (body is not null)
        {
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    // A host with the probe endpoints added. Disposes both the derived host and the root it came from.
    private ProbeHostHandle ProbeHost(IdempotencyProbe probe, TimeProvider? clock = null, string? codeMacKey = null)
    {
        var root = CspsApiFactory.ForDatabase(database.ConnectionString);
        var derived = root.WithWebHostBuilder(builder =>
        {
            if (codeMacKey is not null)
            {
                builder.UseSetting(TestSecrets.CodeMacKeySetting, codeMacKey);
            }

            builder.ConfigureTestServices(services =>
            {
                services.AddControllers().AddApplicationPart(typeof(IdempotencyProbeController).Assembly);
                services.AddSingleton(probe);
                if (clock is not null)
                {
                    services.RemoveAll<TimeProvider>();
                    services.AddSingleton(clock);
                }
            });
        });
        return new ProbeHostHandle(root, derived);
    }

    private async Task<IReadOnlyList<StoredRecord>> ReadRecordsAsync(Guid key)
    {
        await using var context = database.CreateContext();
        var connection = context.Database.GetDbConnection();
        await context.Database.OpenConnectionAsync(TestContext.Current.CancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT [UserId], [Route], [StatusCode], [RequestHash] FROM [IdempotencyRecords] WHERE [Key] = @key";
        var parameter = command.CreateParameter();
        parameter.ParameterName = "@key";
        parameter.Value = key;
        command.Parameters.Add(parameter);

        var rows = new List<StoredRecord>();
        await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            rows.Add(new StoredRecord(
                await reader.IsDBNullAsync(0, TestContext.Current.CancellationToken) ? null : reader.GetGuid(0),
                reader.GetString(1),
                reader.GetInt32(2),
                reader.GetFieldValue<byte[]>(3)));
        }

        return rows;
    }

    private async Task<int> CountRecordsAsync(string route)
    {
        await using var context = database.CreateContext();
        return await context.Set<IdempotencyRecord>().CountAsync(record => record.Route == route, TestContext.Current.CancellationToken);
    }

    private async Task StoreAsync(IdempotencyRecord record)
    {
        await using var context = database.CreateContext();
        context.Add(record);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    // The request as the middleware hashes it: the length-prefixed target, then the body.
    private static byte[] RequestBytes(string target, string body)
    {
        var targetBytes = Encoding.UTF8.GetBytes(target);
        return [.. BitConverter.GetBytes(targetBytes.Length), .. targetBytes, .. Encoding.UTF8.GetBytes(body)];
    }

    private static byte[] PlainHash(string target, string body) => SHA256.HashData(RequestBytes(target, body));

    private static byte[] KeyedHash(string codeMacKey, string target, string body)
    {
        var hasher = new IdempotencyRequestHasher(Options.Create(new AuthSecretsOptions { CodeMacKey = codeMacKey }));
        using var hash = hasher.Create();
        hash.AppendData(RequestBytes(target, body));
        return hash.GetHashAndReset();
    }

    private sealed record StoredRecord(Guid? UserId, string Route, int StatusCode, byte[] RequestHash)
    {
        public int RequestHashLength => RequestHash.Length;
    }

    private sealed class ProbeHostHandle(CspsApiFactory root, WebApplicationFactory<Program> factory) : IAsyncDisposable
    {
        public CspsApiFactory Root { get; } = root;

        public WebApplicationFactory<Program> Factory { get; } = factory;

        public async ValueTask DisposeAsync()
        {
            await Factory.DisposeAsync();
            await Root.DisposeAsync();
        }
    }
}

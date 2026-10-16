using System.Net;
using System.Text;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.RateLimiting;

/// <summary>
/// SEC-03, D-39: the per-address limits on the auth endpoints, with the real numbers. A rejected request gets a plain
/// 429 with a whole-second Retry-After and never reaches a handler.
/// </summary>
public sealed class RateLimitTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task TheEleventhSignInInAMinuteGetsA429AndDoesNoWork()
    {
        await using var factory = new RealLimitsFactory(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var before = await CountFailedSignInsAsync();

        for (var attempt = 1; attempt <= 10; attempt++)
        {
            using var handled = await AuthClient.SignInAsync(client, AuthClient.NewEmail(), "not-the-password");
            handled.StatusCode.ShouldBe(HttpStatusCode.Unauthorized, $"sign-in {attempt} is inside the limit");
        }

        using var rejected = await AuthClient.SignInAsync(client, AuthClient.NewEmail(), "not-the-password");

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        var problem = await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("rate-limited");
        problem.GetProperty("status").GetInt32().ShouldBe(429);
        ProblemJson.TraceId(problem);
        var wait = rejected.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull();
        wait.TotalSeconds.ShouldBeInRange(1, 60);
        (wait.TotalSeconds % 1).ShouldBe(0);
        (await CountFailedSignInsAsync()).ShouldBe(before + 10);
    }

    public static TheoryData<string, string, int> LimitedEndpoints => new()
    {
        { "POST", "/api/v1/auth/sign-in", 10 },
        { "POST", "/api/v1/auth/two-factor/verify", 10 },
        { "POST", "/api/v1/auth/two-factor/resend", 5 },
        { "POST", "/api/v1/auth/password/forgot", 5 },
        { "POST", "/api/v1/auth/password/reset/check", 10 },
        { "POST", "/api/v1/auth/password/reset", 10 },
        { "POST", "/api/v1/auth/password/set-new", 10 },
        { "POST", "/api/v1/auth/password/set-new/check", 10 },
        { "POST", "/api/v1/auth/invite/check", 10 },
        { "POST", "/api/v1/auth/invite/accept", 10 },
        { "POST", "/api/v1/auth/refresh", 60 },
        { "POST", "/api/v1/auth/sign-out", 60 },
        { "POST", "/api/v1/auth/sign-out-others", 60 },
        { "GET", "/api/v1/sessions", 60 },
        { "DELETE", "/api/v1/sessions/6f1d3c52-8a0e-4b7d-9c41-2e5a7b9d0f13", 60 },
    };

    [Theory]
    [MemberData(nameof(LimitedEndpoints))]
    public async Task EveryAuthEndpointCarriesItsPolicy(string method, string route, int limit)
    {
        await using var factory = new RealLimitsFactory(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        for (var attempt = 1; attempt <= limit; attempt++)
        {
            using var handled = await SendAsync(client, method, route, Guid.NewGuid());
            handled.StatusCode.ShouldNotBe(HttpStatusCode.TooManyRequests, $"request {attempt} is inside the limit");
        }

        using var rejected = await SendAsync(client, method, route, Guid.NewGuid());

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        (await ProblemJson.ReadAsync(rejected, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("rate-limited");
        rejected.Headers.RetryAfter.ShouldNotBeNull().Delta.ShouldNotBeNull().TotalSeconds.ShouldBeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task ARejectedPostStoresNoIdempotencyRecord()
    {
        await using var factory = new RealLimitsFactory(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            using var handled = await AuthClient.ForgotPasswordAsync(client, AuthClient.NewEmail());
            handled.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        }

        var key = Guid.NewGuid();
        using var rejected = await AuthClient.ForgotPasswordAsync(client, AuthClient.NewEmail(), idempotencyKey: key);

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        await using var context = database.CreateContext();
        (await context.IdempotencyRecords.AsNoTracking().CountAsync(record => record.Key == key, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    private static async Task<HttpResponseMessage> SendAsync(HttpClient client, string method, string route, Guid key)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), new Uri(route, UriKind.Relative));
        if (method == "POST")
        {
            request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
            request.Headers.Add(AuthClient.IdempotencyKeyHeader, key.ToString("D"));
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private async Task<int> CountFailedSignInsAsync()
    {
        await using var context = database.CreateContext();
        return await context.AuditLog.AsNoTracking().CountAsync(a => a.Action == AuditActions.SignInFailed, TestContext.Current.CancellationToken);
    }
}

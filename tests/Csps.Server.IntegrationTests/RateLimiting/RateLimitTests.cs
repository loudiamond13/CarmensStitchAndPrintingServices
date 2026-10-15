using System.Net;
using System.Text.Json;
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

    private async Task<int> CountFailedSignInsAsync()
    {
        await using var context = database.CreateContext();
        return await context.AuditLog.AsNoTracking().CountAsync(a => a.Action == AuditActions.SignInFailed, TestContext.Current.CancellationToken);
    }
}

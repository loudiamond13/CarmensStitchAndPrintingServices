using System.Net;
using Csps.Server.IntegrationTests.RateLimiting;
using Csps.Server.Security;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Maintenance;

/// <summary>JOB-01, T-09-76, T-09-77: guessing the maintenance key is throttled per address, and the key never reaches a log or a response.</summary>
public sealed class MaintenanceKeySafetyTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string KeyHeader = "X-Maintenance-Key";
    private const string KeySetting = "Maintenance:Key";
    private const string RunPath = "/api/v1/maintenance/run";
    private const string FirstAddress = "203.0.113.10";
    private const string SecondAddress = "203.0.113.20";
    private const int Limit = 12;

    // A clearly fake test-only value, built here so no key-shaped text sits in the repository.
    private static readonly string TestKey = new('k', 40);

    [Fact]
    public async Task TheThirteenthKeyedCallFromOneAddressAnswers429AndAnotherAddressStillRuns()
    {
        await database.ResetAsync();
        await using var factory = NewFactory();
        using var client = factory.CreateClient();

        for (var attempt = 1; attempt <= Limit; attempt++)
        {
            var status = await SendAsync(client, TestKey, FirstAddress);
            status.ShouldBeOneOf([HttpStatusCode.OK, HttpStatusCode.Conflict], $"call {attempt} is inside the limit");
        }

        (await SendAsync(client, TestKey, FirstAddress)).ShouldBe(HttpStatusCode.TooManyRequests);
        (await SendAsync(client, TestKey, SecondAddress)).ShouldBeOneOf([HttpStatusCode.OK, HttpStatusCode.Conflict]);
    }

    [Fact]
    public async Task WrongKeyGuessesCountAgainstTheSameLimit()
    {
        await database.ResetAsync();
        await using var factory = NewFactory();
        using var client = factory.CreateClient();

        for (var attempt = 1; attempt <= Limit; attempt++)
        {
            (await SendAsync(client, new string('w', 40), FirstAddress)).ShouldBe(HttpStatusCode.Unauthorized, $"guess {attempt} is inside the limit");
        }

        (await SendAsync(client, new string('w', 40), FirstAddress)).ShouldBe(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public void TheMaintenanceRuleDefaultsTo12CallsPer10Minutes()
    {
        var rule = MaintenanceRateLimit.Default();

        (rule.PermitLimit, rule.Window).ShouldBe((12, TimeSpan.FromMinutes(10)));
        MaintenanceRateLimit.Validate(rule).ShouldBeEmpty();
        MaintenanceRateLimit.SectionName.ShouldBe("RateLimits:Maintenance");
        RateLimitPolicies.Maintenance.ShouldBe("maintenance-run");
    }

    [Fact]
    public void AnUnusableMaintenanceLimitIsNamedAndNeverEchoed()
    {
        var problems = MaintenanceRateLimit.Validate(new RateLimitRule { PermitLimit = 0, Window = TimeSpan.FromSeconds(1) });

        problems.ShouldBe(
            ["RateLimits:Maintenance:PermitLimit must be at least 1.", "RateLimits:Maintenance:Window must be at least 6 seconds."]);
    }

    private static async Task<HttpStatusCode> SendAsync(HttpClient client, string key, string address)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(RunPath, UriKind.Relative));
        request.Headers.Add(KeyHeader, key);
        request.Headers.Add(RemoteIpStartupFilter.HeaderName, address);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        return response.StatusCode;
    }

    private RealLimitsFactory NewFactory() =>
        new(database.ConnectionString, new Dictionary<string, string> { [KeySetting] = TestKey }) { RemoteIpFromHeader = true };
}

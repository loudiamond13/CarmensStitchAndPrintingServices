using System.Net;
using System.Text.Json;
using Csps.Infrastructure.Idempotency;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Maintenance;

/// <summary>JOB-01, SEC-06, D-21, D-36: a keyed call runs the maintenance jobs and answers plain counts; every other caller meets a 401.</summary>
public sealed class MaintenanceEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string KeyHeader = "X-Maintenance-Key";
    private const string KeySetting = "Maintenance:Key";
    private const string RunPath = "/api/v1/maintenance/run";
    private const string WrongKeyMessage = "The maintenance key is missing or wrong.";
    private const string PurgeLabel = "Expired request keys removed";

    // A clearly fake test-only value, built here so no key-shaped text sits in the repository.
    private static readonly string TestKey = new('k', 40);

    [Fact]
    public async Task AKeyedCallRemovesTheExpiredRequestKeysAndReportsTheCount()
    {
        await database.ResetAsync();
        var kept = await StoreRecordsAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(KeySetting, TestKey));
        using var client = factory.CreateClient();

        using var response = await RunAsync(client, TestKey);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        document.RootElement.GetProperty("ok").GetBoolean().ShouldBeTrue();
        document.RootElement.GetProperty("more").GetBoolean().ShouldBeFalse();
        var line = document.RootElement.GetProperty("lines").EnumerateArray().Single(candidate => candidate.GetProperty("label").GetString() == PurgeLabel);
        line.GetProperty("value").GetInt64().ShouldBe(2);
        line.GetProperty("failed").GetBoolean().ShouldBeFalse();
        (await ReadRecordKeysAsync()).ShouldBe([kept]);
    }

    [Fact]
    public async Task ASecondKeyedCallAtOnceFindsNothingLeftAndReportsZero()
    {
        await database.ResetAsync();
        await StoreRecordsAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(KeySetting, TestKey));
        using var client = factory.CreateClient();

        using var first = await RunAsync(client, TestKey);
        using var second = await RunAsync(client, TestKey);

        first.StatusCode.ShouldBe(HttpStatusCode.OK);
        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("ok").GetBoolean().ShouldBeTrue();
        var line = document.RootElement.GetProperty("lines").EnumerateArray().Single(candidate => candidate.GetProperty("label").GetString() == PurgeLabel);
        line.GetProperty("value").GetInt64().ShouldBe(0);
    }

    [Fact]
    public async Task AMissingKeyAnswers401WithTheKeyMessageAndRunsNothing()
    {
        await database.ResetAsync();
        await StoreRecordsAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(KeySetting, TestKey));
        using var client = factory.CreateClient();

        using var response = await RunAsync(client, key: null);

        await ShouldBeRefusedAsync(response);
        (await ReadRecordKeysAsync()).Count.ShouldBe(3);
    }

    [Fact]
    public async Task AWrongKeyAnswers401WithTheKeyMessageAndRunsNothing()
    {
        await database.ResetAsync();
        await StoreRecordsAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(KeySetting, TestKey));
        using var client = factory.CreateClient();

        using var response = await RunAsync(client, new string('w', 40));

        await ShouldBeRefusedAsync(response);
        (await ReadRecordKeysAsync()).Count.ShouldBe(3);
    }

    [Fact]
    public async Task AHostWithNoKeyConfiguredRefusesEvenACallThatSendsAKey()
    {
        await database.ResetAsync();
        await StoreRecordsAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await RunAsync(client, TestKey);

        await ShouldBeRefusedAsync(response);
        (await ReadRecordKeysAsync()).Count.ShouldBe(3);
    }

    [Fact]
    public async Task AConfiguredKeyShorterThan32CharactersLeavesTheEndpointClosed()
    {
        await database.ResetAsync();
        await StoreRecordsAsync();
        var shortKey = new string('s', 31);
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(KeySetting, shortKey));
        using var client = factory.CreateClient();

        using var response = await RunAsync(client, shortKey);

        await ShouldBeRefusedAsync(response);
        (await ReadRecordKeysAsync()).Count.ShouldBe(3);
    }

    private static async Task ShouldBeRefusedAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("maintenance.key");
        problem.GetProperty("detail").GetString().ShouldBe(WrongKeyMessage);
    }

    private static Task<HttpResponseMessage> RunAsync(HttpClient client, string? key)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(RunPath, UriKind.Relative));
        if (key is not null)
        {
            request.Headers.Add(KeyHeader, key);
        }

        return client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    // Two records that ended 2 days ago and one that is live; returns the live record's key.
    private async Task<Guid> StoreRecordsAsync()
    {
        var now = TimeProvider.System.GetUtcNow();
        var kept = Guid.NewGuid();
        await using var context = database.CreateContext();
        context.Add(IdempotencyRecord.Create(Guid.NewGuid(), null, "POST /test/maintenance", new byte[32], 200, null, null, null, now - TimeSpan.FromDays(2)));
        context.Add(IdempotencyRecord.Create(Guid.NewGuid(), null, "POST /test/maintenance", new byte[32], 200, null, null, null, now - TimeSpan.FromDays(3)));
        context.Add(IdempotencyRecord.Create(kept, null, "POST /test/maintenance", new byte[32], 200, null, null, null, now));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return kept;
    }

    private async Task<IReadOnlyList<Guid>> ReadRecordKeysAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<IdempotencyRecord>().AsNoTracking().Select(record => record.Key).ToListAsync(TestContext.Current.CancellationToken);
    }
}

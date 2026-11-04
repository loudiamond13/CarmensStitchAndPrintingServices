using System.Net;
using System.Text.Json;
using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Images;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Maintenance;

/// <summary>JOB-01, SEC-06, D-21, D-36: a keyed call runs the maintenance jobs and answers plain counts; every other caller meets a 401.</summary>
public sealed class MaintenanceEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string KeyHeader = "X-Maintenance-Key";
    private const string KeySetting = "Maintenance:Key";
    private const string RunPath = "/api/v1/maintenance/run";
    private const string WrongKeyMessage = "The maintenance key is missing or wrong.";
    private const string PurgeLabel = "Expired request keys removed";
    private const string LeaseName = "maintenance-run";
    private const string OverEightyText = "Over 80% of the free Cloudinary plan. Check usage before it runs out.";

    private static readonly TimeSpan Patience = TimeSpan.FromSeconds(20);

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

    [Fact]
    public async Task JobsRunByOrderWhateverTheirRegistrationOrder()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting(KeySetting, TestKey);
            builder.ConfigureTestServices(services =>
            {
                services.AddScoped<IMaintenanceJob>(static _ => new FakeJob(45, "fake-late", "Late job"));
                services.AddScoped<IMaintenanceJob>(static _ => new FakeJob(5, "fake-early", "Early job"));
            });
        });
        using var client = factory.CreateClient();

        using var response = await RunAsync(client, TestKey);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var labels = document.RootElement.GetProperty("lines").EnumerateArray().Select(static line => line.GetProperty("label").GetString()).ToList();
        labels[0].ShouldBe("Early job");
        labels[^1].ShouldBe("Late job");
        labels[1].ShouldBe(PurgeLabel);
        labels.Count.ShouldBeGreaterThan(3);
    }

    [Fact]
    public async Task NinetyPercentOfTheFreePlanMakesTheRunNotOkAndSaysSo()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(KeySetting, TestKey));
        factory.Services.GetRequiredService<TestingImageStorage>().Usage = new StorageUsage(10, 90, 1_610_612_736, 22.5, 25);
        using var client = factory.CreateClient();

        using var response = await RunAsync(client, TestKey);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        document.RootElement.GetProperty("ok").GetBoolean().ShouldBeFalse();
        var lines = document.RootElement.GetProperty("lines").EnumerateArray().ToList();
        lines.Single(line => line.GetProperty("failed").GetBoolean()).GetProperty("text").GetString().ShouldBe(OverEightyText);
        lines.Single(line => line.GetProperty("label").GetString() == "Cloudinary storage used").GetProperty("text").GetString().ShouldBe("1.50 GB");
        lines.Single(line => line.GetProperty("label").GetString() == "Cloudinary credits this month").GetProperty("text").GetString().ShouldBe("22.5 of 25 (90%)");
    }

    [Fact]
    public async Task TenPercentOfTheFreePlanLeavesTheRunOkWithTheUsageLines()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(KeySetting, TestKey));
        factory.Services.GetRequiredService<TestingImageStorage>().Usage = new StorageUsage(5, 10, 536_870_912, 2.5, 25);
        using var client = factory.CreateClient();

        using var response = await RunAsync(client, TestKey);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        document.RootElement.GetProperty("ok").GetBoolean().ShouldBeTrue();
        var lines = document.RootElement.GetProperty("lines").EnumerateArray().ToList();
        lines.ShouldAllBe(line => !line.GetProperty("failed").GetBoolean());
        lines.Single(line => line.GetProperty("label").GetString() == "Cloudinary storage used").GetProperty("text").GetString().ShouldBe("0.50 GB");
        lines.Single(line => line.GetProperty("label").GetString() == "Cloudinary credits this month").GetProperty("text").GetString().ShouldBe("2.5 of 25 (10%)");
    }

    [Fact]
    public async Task TwoKeyedCallsAtOnceGiveOne200AndOne409AndAThirdCallAfterBothAnswers200()
    {
        await database.ResetAsync();
        await ClearLeaseAsync();
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting(KeySetting, TestKey);
            builder.ConfigureTestServices(services => services.AddScoped<IMaintenanceJob>(_ => new HeldJob(started, release)));
        });
        using var client = factory.CreateClient();

        // The run that wins the lease stays in the held job, so the other call can only meet the lease: its answer comes back first.
        var first = Task.Run(() => RunAsync(client, TestKey), TestContext.Current.CancellationToken);
        var second = Task.Run(() => RunAsync(client, TestKey), TestContext.Current.CancellationToken);
        var firstBack = await Task.WhenAny(first, second, Task.Delay(Patience, TestContext.Current.CancellationToken));
        release.SetResult();
        (firstBack == first || firstBack == second).ShouldBeTrue("No call was refused while the other held the lease.");
        var refusedTask = (Task<HttpResponseMessage>)firstBack;
        var winnerTask = refusedTask == first ? second : first;
        using var refused = await refusedTask;
        using var winner = await winnerTask.WaitAsync(Patience, TestContext.Current.CancellationToken);
        using var third = await RunAsync(client, TestKey);

        refused.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var problem = await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("maintenance.running");
        problem.GetProperty("detail").GetString().ShouldBe("A maintenance run is already going. Try again in a few minutes.");
        winner.StatusCode.ShouldBe(HttpStatusCode.OK);
        third.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadLeaseCountAsync()).ShouldBe(0);
    }

    [Fact]
    public async Task ALeaseLeftByACutOffRunRefusesTheNextRunUntilItExpires()
    {
        await database.ResetAsync();
        await ClearLeaseAsync();
        await StoreRecordsAsync();
        await StoreLeaseAsync(TimeProvider.System.GetUtcNow());
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(KeySetting, TestKey));
        using var client = factory.CreateClient();

        try
        {
            using var response = await RunAsync(client, TestKey);

            response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
            (await ReadRecordKeysAsync()).Count.ShouldBe(3);
        }
        finally
        {
            await ClearLeaseAsync();
        }
    }

    [Fact]
    public async Task ALeaseThatHasExpiredIsClearedAndTheRunGoesAhead()
    {
        await database.ResetAsync();
        await ClearLeaseAsync();
        var kept = await StoreRecordsAsync();
        await StoreLeaseAsync(TimeProvider.System.GetUtcNow() - TimeSpan.FromMinutes(10));
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(KeySetting, TestKey));
        using var client = factory.CreateClient();

        using var response = await RunAsync(client, TestKey);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadRecordKeysAsync()).ShouldBe([kept]);
        (await ReadLeaseCountAsync()).ShouldBe(0);
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

    private async Task StoreLeaseAsync(DateTimeOffset takenAt)
    {
        await using var context = database.CreateContext();
        context.Add(DatabaseLock.Claim(LeaseName, Guid.NewGuid(), takenAt, TimeSpan.FromMinutes(3)));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task ClearLeaseAsync()
    {
        await using var context = database.CreateContext();
        await context.Set<DatabaseLock>().Where(claim => claim.Name == LeaseName).ExecuteDeleteAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> ReadLeaseCountAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<DatabaseLock>().CountAsync(claim => claim.Name == LeaseName, TestContext.Current.CancellationToken);
    }

    private async Task<IReadOnlyList<Guid>> ReadRecordKeysAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<IdempotencyRecord>().AsNoTracking().Select(record => record.Key).ToListAsync(TestContext.Current.CancellationToken);
    }

    // Signals that it is running, then stays inside the run until the test lets it go.
    private sealed class HeldJob(TaskCompletionSource started, TaskCompletionSource release) : IMaintenanceJob
    {
        public int Order => 50;

        public string Name => "held";

        public async Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
        {
            started.TrySetResult();
            await release.Task.WaitAsync(Patience, cancellationToken).ConfigureAwait(false);
            return new MaintenanceJobReport([new MaintenanceLine("Held job", 1, false, null)], false);
        }
    }

    private sealed class FakeJob(int order, string name, string label) : IMaintenanceJob
    {
        public int Order => order;

        public string Name => name;

        public Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken) =>
            Task.FromResult(new MaintenanceJobReport([new MaintenanceLine(label, 1, false, null)], false));
    }
}

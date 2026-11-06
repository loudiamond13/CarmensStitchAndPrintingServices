using Csps.Infrastructure.Maintenance;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;

namespace Csps.Infrastructure.IntegrationTests.Maintenance;

/// <summary>JOB-01, D-36: a job that threw is written to the server log with its name and the exception, nowhere else.</summary>
public sealed class MaintenanceJobLogTests
{
    [Fact]
    public void AJobThatThrewIsLoggedAsAnErrorWithItsNameAndTheExceptionAsData()
    {
        var logger = new FakeLogger<MaintenanceJobLog>();
        var thrown = new InvalidOperationException("detail only for the server log");

        new MaintenanceJobLog(logger).JobFailed("purge-expired-records", thrown);

        var record = logger.Collector.GetSnapshot().ShouldHaveSingleItem();
        record.Level.ShouldBe(LogLevel.Error);
        record.Message.ShouldContain("purge-expired-records");
        record.Message.ShouldNotContain("detail only for the server log");
        record.Exception.ShouldBeSameAs(thrown);
    }

    [Fact]
    public void RemovalsThatNeedAttentionAreLoggedAsAWarningWithTheCountOnly()
    {
        var logger = new FakeLogger<MaintenanceJobLog>();

        new MaintenanceJobLog(logger).RemovalsNeedAttention(3);

        var record = logger.Collector.GetSnapshot().ShouldHaveSingleItem();
        record.Level.ShouldBe(LogLevel.Warning);
        record.Message.ShouldContain("3 queued photo removals");
        record.Message.ShouldContain("need attention");
    }
}

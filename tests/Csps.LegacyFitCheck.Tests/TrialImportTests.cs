using Csps.Application.Orders;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using Csps.LegacyFitCheck.Checks;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Mapping;
using Csps.LegacyFitCheck.Trial;
using Csps.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.LegacyFitCheck.Tests;

public sealed class TrialImportTests
{
    private static readonly DateOnly OrderDate = new(2025, 6, 10);

    [Fact]
    public async Task ADuplicateNumberIsImportedOnceAndThenReportedAsNumberTaken()
    {
        var findings = await RunAsync([Order(1, "ORD-2025-0001"), Order(2, "ORD-2025-0001")]);

        findings.Count(static f => f.RuleKey == "trial.imported").ShouldBe(1);
        var taken = findings.Single(static f => f.RuleKey == "trial.number-taken");
        taken.Type.ShouldBe(FindingType.TrialImport);
        taken.LegacyKey.ShouldBe("Orders:2");
    }

    [Fact]
    public async Task AnUnknownProductTypeIsInvalidOnItsOwnPath()
    {
        var snapshot = Snapshot("ORD-2025-0001") with { Items = [NeutralOrder.Item() with { ProductTypeId = Guid.NewGuid() }] };

        var findings = await RunAsync([new MappedOrder("Orders:1", snapshot, [])]);

        var invalid = findings.Single(static f => f.Type == FindingType.TrialImport);
        invalid.RuleKey.ShouldBe("trial.invalid");
        invalid.Path.ShouldBe("items[0].productTypeId");
        invalid.Message.ShouldNotBeNullOrWhiteSpace();
        findings.ShouldNotContain(static f => f.RuleKey == "trial.imported");
    }

    [Fact]
    public async Task AnOrderThatBreaksTheDomainRulesIsInvalidPerFieldPath()
    {
        var snapshot = Snapshot("ORD-2025-0001") with { Items = [NeutralOrder.Item() with { UnitPrice = 12.3450m }] };

        var findings = await RunAsync([new MappedOrder("Orders:1", snapshot, [])]);

        var invalid = findings.Where(static f => f.Type == FindingType.TrialImport).ToList();
        invalid.ShouldAllBe(static f => f.RuleKey == "trial.invalid");
        invalid.ShouldContain(static f => f.Path == "items[0].unitPrice");
    }

    [Fact]
    public async Task TheYearCountersAreRecordedWithValuesOnlyInTheDetail()
    {
        var findings = await RunAsync([Order(1, "ORD-2025-0042"), Order(2, "ORD-2025-0007"), Order(3, "ORD-2024-0003")]);

        var lifted = findings.Where(static f => f.RuleKey == "trial.counter-lifted").ToList();
        lifted.Count.ShouldBe(2);
        lifted.ShouldAllBe(static f => f.Type == FindingType.Info);
        var year2025 = lifted.Single(static f => f.Message!.Contains("2025", StringComparison.Ordinal));
        year2025.Detail.ShouldBe("42");
        year2025.Message!.ShouldNotContain("42");
        lifted.Single(static f => f.Message!.Contains("2024", StringComparison.Ordinal)).Detail.ShouldBe("3");
    }

    [Fact]
    public async Task AnExceptionInOneOrderIsReportedByTypeAndTheNextOrderStillImports()
    {
        var findings = await RunAsync(
            [Order(1, "ORD-2025-0001"), Order(2, "ORD-2025-0002")],
            (key, _) => key == "Orders:1" ? throw new InvalidOperationException("SENTINEL-NAME-7Q") : null);

        var thrown = findings.Single(static f => f.RuleKey == "trial.exception");
        thrown.Type.ShouldBe(FindingType.TrialImport);
        thrown.LegacyKey.ShouldBe("Orders:1");
        thrown.Detail.ShouldBe("InvalidOperationException");
        findings.ShouldAllBe(static f => !(f.Message ?? string.Empty).Contains("SENTINEL", StringComparison.Ordinal) && !(f.Detail ?? string.Empty).Contains("SENTINEL", StringComparison.Ordinal));
        findings.Single(static f => f.RuleKey == "trial.imported").LegacyKey.ShouldBe("Orders:2");
    }

    [Fact]
    public async Task ABusyOutcomeIsRetriedOnce()
    {
        var attempts = 0;
        var busy = 0;

        var findings = await RunAsync(
            [Order(1, "ORD-2025-0001")],
            (_, _) =>
            {
                attempts++;
                if (attempts > 1)
                {
                    return null;
                }

                busy++;
                return Result.Failure<Guid>(OrderErrors.Busy);
            });

        attempts.ShouldBe(2);
        busy.ShouldBe(1);
        findings.Count(static f => f.RuleKey == "trial.imported").ShouldBe(1);
        findings.ShouldNotContain(static f => f.RuleKey == "trial.busy");
    }

    [Fact]
    public async Task TwoBusyOutcomesAreReportedAsBusy()
    {
        var attempts = 0;

        var findings = await RunAsync(
            [Order(1, "ORD-2025-0001")],
            (_, _) =>
            {
                attempts++;
                return Result.Failure<Guid>(OrderErrors.Busy);
            });

        attempts.ShouldBe(2);
        var busy = findings.Single(static f => f.RuleKey == "trial.busy");
        busy.Type.ShouldBe(FindingType.TrialImport);
        findings.ShouldNotContain(static f => f.RuleKey == "trial.imported");
    }

    private static MappedOrder Order(int id, string number) => new($"Orders:{id}", Snapshot(number), []);

    private static OrderImportSnapshot Snapshot(string number) => NeutralOrder.Create(OrderDate) with { Number = number };

    private static async Task<IReadOnlyList<Finding>> RunAsync(IReadOnlyList<MappedOrder> orders, Func<string, int, Result<Guid>?>? overrideResult = null)
    {
        var token = TestContext.Current.CancellationToken;
        var server = await SqlServerInstance.GetSharedAsync();
        var name = TrialDatabaseName.NewName();
        try
        {
            await TrialDatabase.CreateAsync(server.MasterConnectionString, name, token);
            var time = new FakeTimeProvider(new DateTimeOffset(2026, 10, 29, 0, 0, 0, TimeSpan.Zero));
            return await TrialImport.RunAsync(TrialDatabase.ConnectionStringFor(server.MasterConnectionString, name), orders, [], [], time, token, overrideResult);
        }
        finally
        {
            await TrialDatabase.DropAsync(server.MasterConnectionString, name);
        }
    }
}

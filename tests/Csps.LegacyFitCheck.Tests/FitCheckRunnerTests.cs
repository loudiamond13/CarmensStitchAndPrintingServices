using Csps.Infrastructure.Persistence;
using Csps.LegacyFitCheck.Source;
using Csps.LegacyFitCheck.Tests.Fakes;
using Csps.LegacyFitCheck.Trial;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.LegacyFitCheck.Tests;

public sealed class FitCheckRunnerTests
{
    [Fact]
    public async Task OneLegacyOrderRunsEndToEndAndTheTrialDatabaseIsGone()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = Path.Combine(Path.GetTempPath(), $"csps-fitcheck-{Guid.NewGuid():N}", "_local");
            var time = new FakeTimeProvider(new DateTimeOffset(2026, 10, 29, 0, 0, 0, TimeSpan.Zero));
            using var output = new StringWriter();
            using var error = new StringWriter();
            string? trialName = null;
            var hooks = new FitCheckHooks((name, _) =>
            {
                trialName = name;
                return Task.CompletedTask;
            });

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, time, output, error, token, hooks);

                exit.ShouldBe(0, error.ToString());
                output.ToString().ShouldContain("Orders checked: 1.");
                output.ToString().ShouldContain("_local/legacy-fit-check/findings-");
                output.ToString().ShouldNotContain("SENTINEL");
                error.ToString().ShouldNotContain("SENTINEL");

                var file = Directory.EnumerateFiles(Path.Combine(localRoot, "legacy-fit-check"), "findings-*.md").ShouldHaveSingleItem();
                var lines = await File.ReadAllLinesAsync(file, token);
                lines[1].ShouldStartWith("*Created: ");
                var text = string.Join('\n', lines);
                text.ShouldContain("Never commit");
                text.ShouldContain("import.imported");
                text.ShouldNotContain("TrialImport");

                trialName.ShouldNotBeNull();
                (await TrialDatabase.ExistsAsync(server.MasterConnectionString, trialName, token)).ShouldBeFalse();
                (await fake.CountAsync(token)).ShouldBe((1, 2));
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task TheFindingsRecordUnchangedWriteEvidence()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = NewLocalRoot();
            using var output = new StringWriter();
            using var error = new StringWriter();

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, token);

                exit.ShouldBe(0, error.ToString());
                var file = Directory.EnumerateFiles(Path.Combine(localRoot, "legacy-fit-check"), "findings-*.md").ShouldHaveSingleItem();
                var text = await File.ReadAllTextAsync(file, token);
                text.ShouldContain("Write evidence: unchanged (10 tables, 5 rows,");
                output.ToString().ShouldNotContain("Write evidence");
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task ARunWhoseRestoreChangedFails()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = NewLocalRoot();
            using var output = new StringWriter();
            using var error = new StringWriter();
            var hooks = new FitCheckHooks(BetweenEvidence: ct => fake.AddOrderAsync(2, ct));

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, token, hooks);

                exit.ShouldBe(1);
                error.ToString().TrimEnd().ShouldBe("Failed: the restore changed during the run.");
                Directory.Exists(Path.Combine(localRoot, "legacy-fit-check")).ShouldBeFalse();
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task ARefusedSourceExitsTwoAndCreatesNoTrialDatabase()
    {
        // Unreachable loopback address: even a bug cannot reach a real database from this test.
        const string unreachable = "Data Source=127.0.0.1,1;Integrated Security=true;Connect Timeout=1";
        var targets = new FitCheckTargets(unreachable + ";Initial Catalog=CSPS_Dev", unreachable);
        var localRoot = NewLocalRoot();
        using var output = new StringWriter();
        using var error = new StringWriter();
        var trialCreated = false;
        var hooks = new FitCheckHooks((_, _) =>
        {
            trialCreated = true;
            return Task.CompletedTask;
        });

        try
        {
            var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, TestContext.Current.CancellationToken, hooks);

            exit.ShouldBe(2);
            error.ToString().ShouldStartWith("Refused: ");
            error.ToString().ShouldNotContain("127.0.0.1");
            output.ToString().ShouldBeEmpty();
            trialCreated.ShouldBeFalse();
            Directory.Exists(Path.Combine(localRoot, "legacy-fit-check")).ShouldBeFalse();
        }
        finally
        {
            DeleteRoot(localRoot);
        }
    }

    [Fact]
    public async Task AnOrderWithEveryPartImportsThroughTrialOnlyEntries()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            await AddFullOrderAsync(fake, token);
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = NewLocalRoot();
            using var output = new StringWriter();
            using var error = new StringWriter();
            (int Items, int Discounts, int Payments, int Expenses, string? ItemType)? stored = null;
            var hooks = new FitCheckHooks(BeforeTrialDropped: async (name, ct) => stored = await ReadTrialOrderAsync(server.MasterConnectionString, name, ct));

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, token, hooks);

                exit.ShouldBe(0, error.ToString());
                output.ToString().ShouldContain("Orders checked: 2.");
                stored.ShouldBe((2, 1, 1, 1, "Fixture Garments"));

                var file = Directory.EnumerateFiles(Path.Combine(localRoot, "legacy-fit-check"), "findings-*.md").ShouldHaveSingleItem();
                var text = await File.ReadAllTextAsync(file, token);
                Count(text, "| UnmatchedList | list.product-type |").ShouldBe(2);
                text.ShouldContain("| Fixture Garments |");
                Count(text, "| CannotMap | payment.no-method |").ShouldBe(1);
                Count(text, "| CannotMap | payment.deleted-dropped |").ShouldBe(1);
                Count(text, "| CannotMap | order-expense.no-category |").ShouldBe(1);
                Count(text, "| CannotMap | order.no-number |").ShouldBe(2);
                Count(text, "| LegacyHolderUsed |").ShouldBe(2);
                Count(text, "| TrialImport |").ShouldBe(0);
                Count(text, "| Info | import.imported |").ShouldBe(2);
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    private static async Task AddFullOrderAsync(FakeLegacyDatabase fake, CancellationToken token)
    {
        await fake.AddOrderTypeAsync(new LegacyOrderTypeRow { OrderTypeId = 2, OrderTypeName = "Fixture Garments" }, token);
        await fake.AddStatusAsync(new LegacyStatusRow { StatusId = 2, StatusName = "Completed" }, token);
        await fake.AddOrderRowAsync(
            new LegacyOrderRow
            {
                OrderId = 2,
                OrderName = FakeLegacyDatabase.SentinelName + " Full",
                OrderDate = new DateTime(2025, 6, 10, 3, 0, 0, DateTimeKind.Unspecified),
                IsDeleted = false,
                OrderTypeId = 2,
                StatusId = 2,
            },
            token);
        await fake.AddItemAsync(new LegacyOrderItemRow { OrderItemId = 3, OrderId = 2, Description = "Sample shirt", Quantity = 2, Price = 100m }, token);
        await fake.AddItemAsync(new LegacyOrderItemRow { OrderItemId = 4, OrderId = 2, Description = "Sample tag", Quantity = 1, Price = 50m }, token);
        await fake.AddDiscountAsync(new LegacyDiscountRow { OrderDiscountId = 1, OrderId = 2, Description = "Sample promo", Amount = 20m, DiscountedBy = string.Empty }, token);
        await fake.AddPaymentAsync(new LegacyPaymentRow { PaymentId = 1, OrderId = 2, PaymentDate = new DateTime(2025, 6, 11, 3, 0, 0, DateTimeKind.Unspecified), PaidBy = "Sample payer", IsDeleted = false, Amount = 100m, PaidTo = "Sample receiver" }, token);
        await fake.AddPaymentAsync(new LegacyPaymentRow { PaymentId = 2, OrderId = 2, PaymentDate = new DateTime(2025, 6, 12, 3, 0, 0, DateTimeKind.Unspecified), PaidBy = "Sample payer", IsDeleted = true, Amount = 500m, PaidTo = "Sample receiver" }, token);
        await fake.AddExpenseAsync(new LegacyExpenseRow { ExpenseId = 1, OrderId = 2, Description = "Sample thread", SpentDate = new DateTime(2025, 6, 11, 3, 0, 0, DateTimeKind.Unspecified), IsCompanyExpenses = false, Amount = 30m, PaidBy = "Sample payer" }, token);
        await fake.AddExpenseAsync(new LegacyExpenseRow { ExpenseId = 2, OrderId = null, Description = "Sample rent", SpentDate = new DateTime(2025, 6, 11, 3, 0, 0, DateTimeKind.Unspecified), IsCompanyExpenses = true, Amount = 900m, PaidBy = "Sample payer" }, token);
    }

    private static async Task<(int Items, int Discounts, int Payments, int Expenses, string? ItemType)?> ReadTrialOrderAsync(string serverConnection, string name, CancellationToken token)
    {
        var builder = new DbContextOptionsBuilder<CspsDbContext>();
        CspsDbContextOptions.Configure(builder, TrialDatabase.ConnectionStringFor(serverConnection, name));
        var context = new CspsDbContext(builder.Options);
        await using (context.ConfigureAwait(false))
        {
            var order = await context.Orders
                .Include(static row => row.Items)
                .Include(static row => row.Discounts)
                .Include(static row => row.Payments)
                .Include(static row => row.Expenses)
                .SingleAsync(static row => row.Number == "ORD-2025-0002", token);
            var typeName = await context.ProductTypes.Where(row => row.Id == order.Items[0].ProductTypeId).Select(static row => row.Name).SingleAsync(token);
            return (order.Items.Count, order.Discounts.Count, order.Payments.Count, order.Expenses.Count, typeName);
        }
    }

    private static int Count(string text, string needle) =>
        text.Split('\n').Count(line => line.Contains(needle, StringComparison.Ordinal));

    private static string NewLocalRoot() => Path.Combine(Path.GetTempPath(), $"csps-fitcheck-{Guid.NewGuid():N}", "_local");

    private static FakeTimeProvider NewTime() => new(new DateTimeOffset(2026, 10, 29, 0, 0, 0, TimeSpan.Zero));

    private static void DeleteRoot(string localRoot)
    {
        var root = Path.GetDirectoryName(localRoot);
        if (root is not null && Directory.Exists(root))
        {
            Directory.Delete(root, recursive: true);
        }
    }
}

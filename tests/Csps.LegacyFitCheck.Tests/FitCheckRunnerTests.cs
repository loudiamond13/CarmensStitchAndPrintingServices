using Csps.Domain.Identity;
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

    [Fact]
    public async Task KnownStaffBecomePseudonymousTrialStaffAndUnknownNamesUseTheHolder()
    {
        const string StaffName = "SENTINEL-USER-1@example.invalid";
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            await fake.AddUserAsync(new LegacyUserRow { Id = "user-1", UserName = StaffName, Email = StaffName }, token);
            await fake.AddRoleAsync(new LegacyRoleRow { Id = "role-1", Name = "Admin" }, token);
            await fake.AddUserRoleAsync(new LegacyUserRoleRow { UserId = "user-1", RoleId = "role-1" }, token);
            await fake.AddOrderRowAsync(
                new LegacyOrderRow { OrderId = 2, OrderName = "Sample club", OrderDate = new DateTime(2025, 6, 10, 3, 0, 0, DateTimeKind.Unspecified), IsDeleted = false, OrderTypeId = 1, StatusId = 1 },
                token);
            await fake.AddItemAsync(new LegacyOrderItemRow { OrderItemId = 3, OrderId = 2, Description = "Sample shirt", Quantity = 1, Price = 100m }, token);
            await fake.AddPaymentAsync(new LegacyPaymentRow { PaymentId = 1, OrderId = 2, PaymentDate = new DateTime(2025, 6, 11, 3, 0, 0, DateTimeKind.Unspecified), PaidBy = "Sample payer", IsDeleted = false, Amount = 40m, PaidTo = StaffName }, token);
            await fake.AddPaymentAsync(new LegacyPaymentRow { PaymentId = 2, OrderId = 2, PaymentDate = new DateTime(2025, 6, 12, 3, 0, 0, DateTimeKind.Unspecified), PaidBy = "Sample payer", IsDeleted = false, Amount = 30m, PaidTo = "SENTINEL-NOBODY" }, token);
            await fake.AddExpenseAsync(new LegacyExpenseRow { ExpenseId = 1, OrderId = 2, Description = "Sample thread", SpentDate = new DateTime(2025, 6, 11, 3, 0, 0, DateTimeKind.Unspecified), IsCompanyExpenses = false, Amount = 10m, PaidBy = StaffName }, token);
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = NewLocalRoot();
            using var output = new StringWriter();
            using var error = new StringWriter();
            TrialPeople? people = null;
            var hooks = new FitCheckHooks(BeforeTrialDropped: async (name, ct) => people = await ReadTrialPeopleAsync(server.MasterConnectionString, name, ct));

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, token, hooks);

                exit.ShouldBe(0, error.ToString());
                var staff = people.ShouldNotBeNull().Staff.ShouldHaveSingleItem();
                staff.FirstName.ShouldBe("Legacy");
                staff.LastName.ShouldBe("staff 1");
                staff.Email.ShouldBe("legacy-staff-1@example.invalid");
                people.Staff.ShouldAllBe(static user => !user.FirstName.Contains("SENTINEL", StringComparison.OrdinalIgnoreCase)
                    && !user.LastName.Contains("SENTINEL", StringComparison.OrdinalIgnoreCase)
                    && !user.Email.Contains("SENTINEL", StringComparison.OrdinalIgnoreCase));
                people.Receivers.ShouldBe([staff.Id, LegacyHolder.Id]);
                people.Payers.ShouldBe([staff.Id]);

                var file = Directory.EnumerateFiles(Path.Combine(localRoot, "legacy-fit-check"), "findings-*.md").ShouldHaveSingleItem();
                var text = await File.ReadAllTextAsync(file, token);
                Count(text, "| UnmatchedPerson | person.unknown-name |").ShouldBe(1);
                Count(text, "| LegacyHolderUsed |").ShouldBe(1);
                Count(text, "| TrialImport |").ShouldBe(0);
                Count(text, "| Info | import.imported |").ShouldBe(2);
                output.ToString().ShouldNotContain("SENTINEL");
                error.ToString().ShouldNotContain("SENTINEL");
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task EveryRuleAnOrderBreaksIsReported()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            await fake.AddOrderRowAsync(
                new LegacyOrderRow { OrderId = 2, OrderName = "Sample club", OrderDate = new DateTime(2025, 6, 10, 3, 0, 0, DateTimeKind.Unspecified), IsDeleted = false, OrderTypeId = 1, StatusId = 1 },
                token);
            await fake.AddItemAsync(new LegacyOrderItemRow { OrderItemId = 3, OrderId = 2, Description = "Sample shirt", Quantity = 1, Price = 12.3450m }, token);
            await fake.AddPaymentAsync(new LegacyPaymentRow { PaymentId = 1, OrderId = 2, PaymentDate = new DateTime(2025, 6, 11, 3, 0, 0, DateTimeKind.Unspecified), PaidBy = "Sample payer", IsDeleted = false, Amount = 0.0000m, PaidTo = "Sample receiver" }, token);
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
                var lines = (await File.ReadAllLinesAsync(file, token)).Where(static line => line.Contains("| Orders:2 |", StringComparison.Ordinal)).ToList();

                lines.Count(static line => line.Contains("| RuleBreak |", StringComparison.Ordinal) && line.Contains("| items[0].unitPrice |", StringComparison.Ordinal)).ShouldBe(1);
                lines.Count(static line => line.Contains("| RuleBreak |", StringComparison.Ordinal) && line.Contains("| payments[0].amount |", StringComparison.Ordinal)).ShouldBe(1);
                lines.Count(static line => line.Contains("| ReliesOnRelaxation | ContactNumberOptional |", StringComparison.Ordinal)).ShouldBe(1);

                // The trial import stops at the first failure only.
                var trial = lines.Where(static line => line.Contains("| TrialImport |", StringComparison.Ordinal)).ToList();
                trial.ShouldHaveSingleItem().ShouldContain("| items[0].unitPrice |");
                output.ToString().ShouldNotContain("SENTINEL");
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task AStoredTotalOffByACentavoIsListedWithAmountsOnlyInTheLocalFile()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            await fake.AddOrderRowAsync(
                new LegacyOrderRow { OrderId = 2, OrderName = "Sample club", OrderDate = new DateTime(2025, 6, 10, 3, 0, 0, DateTimeKind.Unspecified), IsDeleted = false, OrderTypeId = 1, StatusId = 1, TotalAmount = 100.0000m, TotalBalance = 100m },
                token);
            await fake.AddOrderRowAsync(
                new LegacyOrderRow { OrderId = 3, OrderName = "Sample team", OrderDate = new DateTime(2025, 6, 10, 3, 0, 0, DateTimeKind.Unspecified), IsDeleted = false, OrderTypeId = 1, StatusId = 1, TotalAmount = 99.99m, TotalBalance = 100m },
                token);
            await fake.AddItemAsync(new LegacyOrderItemRow { OrderItemId = 3, OrderId = 2, Description = "Sample shirt", Quantity = 1, Price = 100m }, token);
            await fake.AddItemAsync(new LegacyOrderItemRow { OrderItemId = 4, OrderId = 3, Description = "Sample shirt", Quantity = 1, Price = 100m }, token);
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
                var lines = await File.ReadAllLinesAsync(file, token);
                var mismatches = lines.Where(static line => line.Contains("| TotalMismatch |", StringComparison.Ordinal)).ToList();
                var one = mismatches.ShouldHaveSingleItem();
                one.ShouldContain("| Orders:3 |");
                one.ShouldContain("| totals.total |");
                one.ShouldContain("99.99");
                output.ToString().ShouldNotContain("99.99");
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    private sealed record TrialStaffRow(Guid Id, string FirstName, string LastName, string Email);

    private sealed record TrialPeople(IReadOnlyList<TrialStaffRow> Staff, IReadOnlyList<Guid> Receivers, IReadOnlyList<Guid> Payers);

    private static async Task<TrialPeople> ReadTrialPeopleAsync(string serverConnection, string name, CancellationToken token)
    {
        var builder = new DbContextOptionsBuilder<CspsDbContext>();
        CspsDbContextOptions.Configure(builder, TrialDatabase.ConnectionStringFor(serverConnection, name));
        var context = new CspsDbContext(builder.Options);
        await using (context.ConfigureAwait(false))
        {
            var users = await context.Users.Where(static user => user.Id != LegacyHolder.Id).ToListAsync(token);
            var order = await context.Orders.Include(static row => row.Payments).Include(static row => row.Expenses).SingleAsync(static row => row.Number == "ORD-2025-0002", token);
            return new TrialPeople(
                [.. users.Select(static user => new TrialStaffRow(user.Id, user.FirstName, user.LastName, user.Email ?? string.Empty))],
                [.. order.Payments.OrderBy(static row => row.Position).Select(static row => row.ReceivedByUserId)],
                [.. order.Expenses.Select(static row => row.PaidByUserId)]);
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

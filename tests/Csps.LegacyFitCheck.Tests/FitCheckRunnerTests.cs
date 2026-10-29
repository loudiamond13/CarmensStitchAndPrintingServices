using Csps.Domain.Expenses;
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
                text.ShouldContain("trial.imported");
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
                Count(text, "| Payment | Payments:1 | LegacyHolderUsed |").ShouldBe(1);
                Count(text, "| OrderExpense | Expenses:1 | LegacyHolderUsed |").ShouldBe(1);
                Count(text, "| CompanyExpense | Expenses:2 | LegacyHolderUsed |").ShouldBe(1);
                Count(text, "| TrialImport |").ShouldBe(0);
                Count(text, "| Info | trial.imported |").ShouldBe(2);
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
                Count(text, "| Info | trial.imported |").ShouldBe(2);
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

    [Fact]
    public async Task AThrowAfterTheTrialDatabaseExistsStillDropsIt()
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
            string? trialName = null;
            var hooks = new FitCheckHooks((name, _) =>
            {
                trialName = name;
                throw new InvalidOperationException("SENTINEL-NAME-7Q");
            });

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, token, hooks);

                exit.ShouldBe(1);
                error.ToString().TrimEnd().ShouldBe("Failed: InvalidOperationException");
                output.ToString().ShouldNotContain("SENTINEL");
                Directory.Exists(Path.Combine(localRoot, "legacy-fit-check")).ShouldBeFalse();
                trialName.ShouldNotBeNull();
                (await TrialDatabase.ExistsAsync(server.MasterConnectionString, trialName, token)).ShouldBeFalse();
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task TheRunConfirmsTheTrialDatabaseIsGone()
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
                (await File.ReadAllTextAsync(file, token)).ShouldContain("Trial database removed: yes");
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task ARefusedTrialServerExitsTwoBeforeAnyConnection()
    {
        // Both addresses are unreachable: a bug cannot reach a real server from this test.
        var source = "Data Source=127.0.0.1,1;Integrated Security=true;Connect Timeout=1;Initial Catalog=" + TrialDatabaseName.NewName();
        var targets = new FitCheckTargets(source, "Data Source=SENTINEL-HOST.example.invalid;Integrated Security=true;Connect Timeout=1");
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
            error.ToString().ShouldNotContain("SENTINEL");
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
    public async Task CompanyExpensesAreCheckedAndNothingIsSaved()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            await fake.AddExpenseAsync(
                new LegacyExpenseRow { ExpenseId = 1, OrderId = null, Description = "Sample rent", SpentDate = new DateTime(2025, 3, 4, 2, 30, 0, DateTimeKind.Unspecified), IsCompanyExpenses = true, Amount = 0.0000m, PaidBy = "SENTINEL-NOBODY" },
                token);
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = NewLocalRoot();
            using var output = new StringWriter();
            using var error = new StringWriter();
            (int Expenses, int Audits) before = default;
            (int Expenses, int Audits) after = default;
            var hooks = new FitCheckHooks(
                AfterTrialCreated: async (name, ct) => before = await ReadTrialExpenseCountsAsync(server.MasterConnectionString, name, ct),
                BeforeTrialDropped: async (name, ct) => after = await ReadTrialExpenseCountsAsync(server.MasterConnectionString, name, ct));

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, token, hooks);

                exit.ShouldBe(0, error.ToString());
                output.ToString().ShouldContain("Company expenses checked: 1.");
                output.ToString().ShouldNotContain("SENTINEL");
                after.Expenses.ShouldBe(0);
                after.Audits.ShouldBe(before.Audits);

                var file = Directory.EnumerateFiles(Path.Combine(localRoot, "legacy-fit-check"), "findings-*.md").ShouldHaveSingleItem();
                var lines = (await File.ReadAllLinesAsync(file, token)).Where(static line => line.StartsWith("| CompanyExpense | Expenses:1 |", StringComparison.Ordinal)).ToList();
                lines.Count(static line => line.Contains($"| ExpenseRule | Amount: {ExpenseRules.AmountTooSmall} |", StringComparison.Ordinal)).ShouldBe(1);
                lines.Count(static line => line.Contains($"| ExpenseRule | PaidByUserId: {ExpenseRules.PaidByInactive} |", StringComparison.Ordinal)).ShouldBe(1);
                lines.Count(static line => line.Contains("| CannotMap | company-expense.no-category |", StringComparison.Ordinal)).ShouldBe(1);
                lines.Count(static line => line.Contains("| LegacyHolderUsed | person.legacy-holder |", StringComparison.Ordinal)).ShouldBe(1);
                lines.Count(static line => line.Contains("| ExpenseRule |", StringComparison.Ordinal)).ShouldBe(2);
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task TheSummaryHoldsCountsAndListWordsOnly()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            await AddSentinelOrderAsync(fake, "SENTINEL-DESC-7Q", token);
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = NewLocalRoot();
            using var output = new StringWriter();
            using var error = new StringWriter();

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, token);

                exit.ShouldBe(0, error.ToString());
                var folder = Path.Combine(localRoot, "legacy-fit-check");
                var full = await File.ReadAllTextAsync(Directory.EnumerateFiles(folder, "findings-*.md").ShouldHaveSingleItem(), token);
                full.ShouldContain("SENTINEL-UNKNOWN-7Q");

                var summaryLines = await File.ReadAllLinesAsync(Directory.EnumerateFiles(folder, "summary-*.md").ShouldHaveSingleItem(), token);
                summaryLines[1].ShouldStartWith("*Created: ");
                var summary = string.Join('\n', summaryLines);
                summary.ShouldNotContain("SENTINEL", Case.Insensitive);
                summary.ShouldNotContain("ORD-");
                summary.ShouldNotContain("Orders:");
                summary.ShouldContain("Product type 'Fixture Garments' has no match: 1 item");
                summary.ShouldContain("Write evidence: unchanged");
                summary.ShouldContain("Trial database removed: yes");

                var console = output.ToString();
                console.ShouldContain("Orders checked: 2. Company expenses checked: 1. Findings: ");
                console.ShouldContain("Full list (never commit): _local/legacy-fit-check/findings-");
                console.ShouldContain("Summary (counts only): _local/legacy-fit-check/summary-");
                console.ShouldNotContain("SENTINEL", Case.Insensitive);
                error.ToString().ShouldNotContain("SENTINEL", Case.Insensitive);
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task ASummaryHoldingAReadValueIsNotWritten()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            await AddSentinelOrderAsync(fake, "Trial database removed", token);
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = NewLocalRoot();
            using var output = new StringWriter();
            using var error = new StringWriter();

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, token);

                exit.ShouldBe(1);
                error.ToString().TrimEnd().ShouldBe("Failed: the summary held a personal value, so it was not written.");
                var folder = Path.Combine(localRoot, "legacy-fit-check");
                Directory.EnumerateFiles(folder, "summary-*.md").ShouldBeEmpty();
                output.ToString().ShouldNotContain("Summary (counts only)");
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    [Fact]
    public async Task ExpensesWithNoOrderThatAreNotCompanyExpensesAreCountedWithNoValues()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var spent = new DateTime(2025, 6, 11, 3, 0, 0, DateTimeKind.Unspecified);
            await fake.AddExpenseAsync(new LegacyExpenseRow { ExpenseId = 1, OrderId = 1, Description = "Sample thread", SpentDate = spent, IsCompanyExpenses = false, Amount = 10m, PaidBy = "Sample payer" }, token);
            await fake.AddExpenseAsync(new LegacyExpenseRow { ExpenseId = 2, OrderId = null, Description = "Sample rent", SpentDate = spent, IsCompanyExpenses = true, Amount = 900m, PaidBy = "Sample payer" }, token);
            await fake.AddExpenseAsync(new LegacyExpenseRow { ExpenseId = 3, OrderId = null, Description = "SENTINEL-UNPLACED-DESC", SpentDate = spent, IsCompanyExpenses = false, Amount = 777.77m, PaidBy = "SENTINEL-UNPLACED-PAYER" }, token);
            await fake.AddExpenseAsync(new LegacyExpenseRow { ExpenseId = 4, OrderId = null, Description = "SENTINEL-UNPLACED-DESC", SpentDate = null, IsCompanyExpenses = false, Amount = 777.77m, PaidBy = string.Empty }, token);
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = NewLocalRoot();
            using var output = new StringWriter();
            using var error = new StringWriter();

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, NewTime(), output, error, token);

                exit.ShouldBe(0, error.ToString());
                output.ToString().ShouldContain("Company expenses checked: 1.");
                var folder = Path.Combine(localRoot, "legacy-fit-check");
                var full = await File.ReadAllTextAsync(Directory.EnumerateFiles(folder, "findings-*.md").ShouldHaveSingleItem(), token);
                Count(full, "| expense.unplaced |").ShouldBe(2);
                Count(full, "| Expenses:3 | CannotMap | expense.unplaced |").ShouldBe(1);
                Count(full, "| Expenses:4 | CannotMap | expense.unplaced |").ShouldBe(1);
                full.ShouldNotContain("SENTINEL-UNPLACED");
                full.ShouldNotContain("777.77");

                var summary = await File.ReadAllTextAsync(Directory.EnumerateFiles(folder, "summary-*.md").ShouldHaveSingleItem(), token);
                summary.ShouldContain("Expenses with no order and not marked as company expenses (counted only, not judged): 2 expenses");
                summary.ShouldNotContain("SENTINEL", Case.Insensitive);
                summary.ShouldNotContain("777.77");
                summary.ShouldNotContain("Expenses:");
            }
            finally
            {
                DeleteRoot(localRoot);
            }
        }
    }

    private static async Task AddSentinelOrderAsync(FakeLegacyDatabase fake, string description, CancellationToken token)
    {
        await fake.AddOrderTypeAsync(new LegacyOrderTypeRow { OrderTypeId = 2, OrderTypeName = "Fixture Garments" }, token);
        await fake.AddUserAsync(new LegacyUserRow { Id = "user-1", UserName = "SENTINEL-USER-7Q@example.invalid", Email = "SENTINEL-USER-7Q@example.invalid" }, token);
        await fake.AddOrderRowAsync(
            new LegacyOrderRow
            {
                OrderId = 2,
                OrderName = FakeLegacyDatabase.SentinelName,
                Note = "SENTINEL-NOTE-7Q",
                OrderDate = new DateTime(2025, 6, 10, 3, 0, 0, DateTimeKind.Unspecified),
                IsDeleted = false,
                OrderTypeId = 2,
                StatusId = 1,
            },
            token);
        await fake.AddItemAsync(new LegacyOrderItemRow { OrderItemId = 3, OrderId = 2, Description = description, Quantity = 1, Price = 100m }, token);
        await fake.AddDiscountAsync(new LegacyDiscountRow { OrderDiscountId = 1, OrderId = 2, Description = "SENTINEL-DESC-7Q", Amount = 5m, DiscountedBy = "SENTINEL-GIVER-7Q" }, token);
        await fake.AddPaymentAsync(new LegacyPaymentRow { PaymentId = 1, OrderId = 2, PaymentDate = new DateTime(2025, 6, 11, 3, 0, 0, DateTimeKind.Unspecified), PaidBy = "SENTINEL-PAYER-7Q", IsDeleted = false, Amount = 40m, PaidTo = "SENTINEL-UNKNOWN-7Q" }, token);
        await fake.AddExpenseAsync(new LegacyExpenseRow { ExpenseId = 1, OrderId = 2, Description = "SENTINEL-DESC-7Q", SpentDate = new DateTime(2025, 6, 11, 3, 0, 0, DateTimeKind.Unspecified), IsCompanyExpenses = false, Amount = 10m, PaidBy = "SENTINEL-PAYER-7Q" }, token);
        await fake.AddExpenseAsync(new LegacyExpenseRow { ExpenseId = 2, OrderId = null, Description = "SENTINEL-DESC-7Q", SpentDate = new DateTime(2025, 6, 11, 3, 0, 0, DateTimeKind.Unspecified), IsCompanyExpenses = true, Amount = 0m, PaidBy = "SENTINEL-PAYER-7Q" }, token);
    }

    private static async Task<(int Expenses, int Audits)> ReadTrialExpenseCountsAsync(string serverConnection, string name, CancellationToken token)
    {
        var builder = new DbContextOptionsBuilder<CspsDbContext>();
        CspsDbContextOptions.Configure(builder, TrialDatabase.ConnectionStringFor(serverConnection, name));
        var context = new CspsDbContext(builder.Options);
        await using (context.ConfigureAwait(false))
        {
            var expenses = await context.CompanyExpenses.IgnoreQueryFilters().CountAsync(token);
            var audits = await context.AuditLog.CountAsync(token);
            return (expenses, audits);
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

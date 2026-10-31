using Csps.Application.Expenses;
using Csps.Domain.Expenses;
using Csps.Domain.Identity;
using Csps.Infrastructure;
using Csps.Infrastructure.Expenses;
using Csps.Infrastructure.Persistence;
using Csps.LegacyFitCheck.Checks;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Mapping;
using Csps.LegacyFitCheck.Trial;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.LegacyFitCheck.Tests;

public sealed class CompanyExpenseCheckTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateOnly Today = new(2026, 10, 29);
    private static readonly DateTimeOffset Now = new(2026, 10, 29, 0, 0, 0, TimeSpan.Zero);

    private static int _staffNumber;

    [Fact]
    public async Task EveryFieldFailureIsReportedInOneCall()
    {
        var payer = await SeedStaffAsync();
        var request = Valid(payer) with { Amount = 0m, Date = Today.AddDays(ExpenseRules.DaysAhead + 1).ToString(ExpenseRules.DateFormat, System.Globalization.CultureInfo.InvariantCulture), Description = new string('x', ExpenseRules.DescriptionMaxLength + 1) };

        var findings = await CheckAsync(request);

        findings.Count.ShouldBe(3);
        findings.ShouldAllBe(static finding => finding.Type == FindingType.ExpenseRule && finding.Kind == RecordKind.CompanyExpense && finding.LegacyKey == "Expenses:7");
        findings.Select(static finding => finding.RuleKey).ShouldBe(
        [
            $"Date: {ExpenseRules.DateTooFar(ExpenseRules.Latest(Today))}",
            $"Description: {ExpenseRules.DescriptionTooLong}",
            $"Amount: {ExpenseRules.AmountTooSmall}",
        ]);
        findings.Select(static finding => finding.Path).ShouldBe(["Date", "Description", "Amount"]);
    }

    [Fact]
    public async Task AnUnknownCategoryIsRefusedLikeTheHandlerDoes()
    {
        var payer = await SeedStaffAsync();

        var findings = await CheckAsync(Valid(payer) with { CategoryId = Guid.NewGuid() });

        var finding = findings.ShouldHaveSingleItem();
        finding.RuleKey.ShouldBe($"CategoryId: {ExpenseRules.CategoryRequired}");
        finding.Path.ShouldBe("CategoryId");
    }

    [Fact]
    public async Task ARetiredCategoryIsRefused()
    {
        var payer = await SeedStaffAsync();
        var rent = ExpenseCategorySeed.Rows.First(static row => row.Id != ExpenseCategorySeed.OthersId).Id;
        var context = database.CreateContext();
        await using (context.ConfigureAwait(true))
        {
            var category = await context.ExpenseCategories.SingleAsync(row => row.Id == rent, TestContext.Current.CancellationToken);
            category.Retire(Now).IsSuccess.ShouldBeTrue();
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var findings = await CheckAsync(Valid(payer) with { CategoryId = rent });

        findings.ShouldHaveSingleItem().RuleKey.ShouldBe($"CategoryId: {ExpenseRules.CategoryRetired}");
    }

    [Fact]
    public async Task AnActiveStaffMemberPassesThePayerCheck()
    {
        var payer = await SeedStaffAsync();

        var findings = await CheckAsync(Valid(payer));

        findings.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheLegacyHolderCannotPay()
    {
        var findings = await CheckAsync(Valid(LegacyHolder.Id));

        findings.ShouldHaveSingleItem().RuleKey.ShouldBe($"PaidByUserId: {ExpenseRules.PaidByInactive}");
    }

    [Fact]
    public async Task AnUnknownPayerCannotPay()
    {
        var findings = await CheckAsync(Valid(Guid.NewGuid()));

        findings.ShouldHaveSingleItem().RuleKey.ShouldBe($"PaidByUserId: {ExpenseRules.PaidByInactive}");
    }

    [Fact]
    public async Task EmptyIdsAreOnlyJudgedByTheValidatorAndNeverLookedUp()
    {
        var findings = await CheckAsync(Valid(Guid.Empty) with { CategoryId = Guid.Empty });

        findings.Select(static finding => finding.RuleKey).ShouldBe(
        [
            $"CategoryId: {ExpenseRules.CategoryRequired}",
            $"PaidByUserId: {ExpenseRules.PaidByRequired}",
        ]);
    }

    [Fact]
    public async Task AMissingDateIsReportedByTheValidator()
    {
        var payer = await SeedStaffAsync();

        var findings = await CheckAsync(Valid(payer) with { Date = null });

        findings.ShouldHaveSingleItem().RuleKey.ShouldBe($"Date: {ExpenseRules.DateRequired}");
    }

    private static CreateCompanyExpenseRequest Valid(Guid payer) =>
        new("2026-10-01", ExpenseCategorySeed.OthersId, "Sample rent", 120.50m, payer, null);

    // Runs the check in a fresh scope and proves it saved nothing: no company expense and no audit row appear.
    private async Task<IReadOnlyList<Finding>> CheckAsync(CreateCompanyExpenseRequest request)
    {
        var token = TestContext.Current.CancellationToken;
        var before = await CountsAsync(token);
        var services = new ServiceCollection();
        services.AddCspsPersistence(database.ConnectionString);
        services.AddCspsExpenses();
        var provider = services.BuildServiceProvider();
        IReadOnlyList<Finding> findings;
        await using (provider.ConfigureAwait(true))
        {
            var scope = provider.CreateAsyncScope();
            await using (scope.ConfigureAwait(true))
            {
                findings = await CompanyExpenseCheck.CheckAsync(
                    "Expenses:7",
                    request,
                    Today,
                    scope.ServiceProvider.GetRequiredService<Csps.Application.Ports.IExpenseCategories>(),
                    scope.ServiceProvider.GetRequiredService<Csps.Application.Ports.IStaffDirectory>(),
                    token);
            }
        }

        var after = await CountsAsync(token);
        after.ShouldBe(before);
        after.Expenses.ShouldBe(0);
        return findings;
    }

    private async Task<(int Expenses, int Audits)> CountsAsync(CancellationToken token)
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(true))
        {
            return (await context.CompanyExpenses.IgnoreQueryFilters().CountAsync(token), await context.AuditLog.CountAsync(token));
        }
    }

    // A seeded Admin who is active, confirmed and has a password: the same set-up the trial staff get.
    private async Task<Guid> SeedStaffAsync()
    {
        var number = Interlocked.Increment(ref _staffNumber).ToString(System.Globalization.CultureInfo.InvariantCulture);
        var staff = new TrialStaff(Guid.NewGuid(), $"Legacy staff {number}", $"legacy-staff-{number}@example.invalid");
        var context = database.CreateContext();
        await using (context.ConfigureAwait(true))
        {
            await TrialSeeder.SeedStaffAsync(context, [staff], Now, TestContext.Current.CancellationToken);
        }

        return staff.Id;
    }
}

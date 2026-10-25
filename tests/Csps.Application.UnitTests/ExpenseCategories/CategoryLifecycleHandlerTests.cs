using Csps.Application.Auth;
using Csps.Application.ExpenseCategories;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Expenses;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.ExpenseCategories;

/// <summary>
/// CEXP-02, D-10, D-11, D-27, D-30, OQ-4, OQ-6: retire, bring back and delete are single clicks with no version. Each runs in one
/// transaction with its audit entry, reads again after a lost race, does nothing for a category already in the wanted state, and
/// delete refuses Others and any category an expense still uses.
/// </summary>
public sealed class CategoryLifecycleHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = Now.AddHours(1);

    [Fact]
    public async Task RetiringAnUnknownCategoryIsA404AndNothingIsWritten()
    {
        var harness = new Harness(found: false);

        var result = await harness.Retire.HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseCategoryErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task RetiringAnActiveCategoryMarksItAtTheClockAuditsAndSavesOnce()
    {
        var harness = new Harness();

        var result = await harness.Retire.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Category.IsRetired.ShouldBeTrue();
        harness.Category.RetiredAtUtc.ShouldBe(Later);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(
            AuditActions.ExpenseCategoryRetired, "ExpenseCategory", harness.Id.ToString("D"), "name=Laundry", Independent: false));
    }

    [Fact]
    public async Task RetiringARetiredCategoryIsSuccessThatWritesAndAuditsNothing()
    {
        var harness = new Harness(retired: true);

        var result = await harness.Retire.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task RetiringOthersIsRefusedAsProtected()
    {
        var harness = new Harness(others: true);

        var result = await harness.Retire.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseCategoryErrors.Protected);
        result.Error.Code.ShouldBe("expense-categories.protected");
        harness.Category.IsRetired.ShouldBeFalse();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ARetireThatLosesARaceReadsAgainAndRetiresTheFreshRow()
    {
        var harness = new Harness(freshRowEachRead: true);
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Retire.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Served.Count.ShouldBe(2);
        harness.Served[^1].IsRetired.ShouldBeTrue();
    }

    [Fact]
    public async Task TwoLostRacesOnARetireAnswerBusy()
    {
        var harness = new Harness(freshRowEachRead: true);
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Retire.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task ReactivatingAnUnknownCategoryIsA404()
    {
        var harness = new Harness(found: false);

        var result = await harness.Reactivate.HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseCategoryErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ReactivatingARetiredCategoryBringsItBackAuditsAndSavesOnce()
    {
        var harness = new Harness(retired: true);

        var result = await harness.Reactivate.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Category.IsRetired.ShouldBeFalse();
        harness.Unit.Saves.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(
            AuditActions.ExpenseCategoryReactivated, "ExpenseCategory", harness.Id.ToString("D"), "name=Laundry", Independent: false));
    }

    [Fact]
    public async Task ReactivatingAnActiveCategoryIsSuccessThatWritesAndAuditsNothing()
    {
        var harness = new Harness();

        var result = await harness.Reactivate.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AReactivateThatLosesARaceReadsAgain()
    {
        var harness = new Harness(retired: true, freshRowEachRead: true);
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Reactivate.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task TwoLostRacesOnAReactivateAnswerBusy()
    {
        var harness = new Harness(retired: true, freshRowEachRead: true);
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Reactivate.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task DeletingAnUnknownCategoryIsA404()
    {
        var harness = new Harness(found: false);

        var result = await harness.Delete.HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseCategoryErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task DeletingOthersIsRefusedAsProtectedWithoutCountingExpenses()
    {
        var harness = new Harness(others: true);

        var result = await harness.Delete.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseCategoryErrors.Protected);
        await harness.Categories.DidNotReceiveWithAnyArgs().CountExpensesAsync(default, TestContext.Current.CancellationToken);
        harness.Categories.DidNotReceiveWithAnyArgs().Remove(default!);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ACategoryAnExpenseUsesCannotBeDeleted()
    {
        var harness = new Harness(expenseCount: 1);

        var result = await harness.Delete.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseCategoryErrors.InUse);
        result.Error.Code.ShouldBe("expense-categories.in-use");
        result.Error.Message.ShouldBe("This category is used by an expense, so it can't be deleted. Retire it instead.");
        harness.Categories.DidNotReceiveWithAnyArgs().Remove(default!);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnusedCategoryIsAuditedRemovedAndSavedInOneTransaction()
    {
        var harness = new Harness();

        var result = await harness.Delete.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Categories.Received(1).Remove(harness.Category);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(
            AuditActions.ExpenseCategoryDeleted, "ExpenseCategory", harness.Id.ToString("D"), "name=Laundry", Independent: false));
    }

    [Fact]
    public async Task AnExpenseAddedBeforeTheSaveMakesTheForeignKeyBackstopAnInUseAnswer()
    {
        var harness = new Harness();
        harness.Unit.ThrowOnSave(new CategoryInUseException());

        var result = await harness.Delete.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseCategoryErrors.InUse);
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task ADeleteThatLosesARaceReadsAgainAndDeletes()
    {
        var harness = new Harness(freshRowEachRead: true);
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Delete.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task TwoLostRacesOnADeleteAnswerBusy()
    {
        var harness = new Harness(freshRowEachRead: true);
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Delete.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task ADeleteWhoseCategoryVanishesOnTheSecondPassIsA404()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();
        harness.Categories.FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<ExpenseCategory?>(harness.Category), Task.FromResult<ExpenseCategory?>(null));

        var result = await harness.Delete.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseCategoryErrors.NotFound);
    }

    private sealed class Harness
    {
        private readonly bool _others;
        private readonly bool _retired;

        public Harness(bool found = true, bool retired = false, bool others = false, bool freshRowEachRead = false, int expenseCount = 0)
        {
            _others = others;
            _retired = retired;
            Category = Build();
            Categories = Substitute.For<IExpenseCategories>();
            Categories.FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(_ =>
            {
                if (!found)
                {
                    return Task.FromResult<ExpenseCategory?>(null);
                }

                var served = Served.Count == 0 || !freshRowEachRead ? Category : Build();
                Served.Add(served);
                return Task.FromResult<ExpenseCategory?>(served);
            });
            Categories.CountExpensesAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(expenseCount);
            var time = new FakeTimeProvider(Later);
            Retire = new RetireExpenseCategoryHandler(Categories, Audit, Unit, time);
            Reactivate = new ReactivateExpenseCategoryHandler(Categories, Audit, Unit);
            Delete = new DeleteExpenseCategoryHandler(Categories, Audit, Unit);
        }

        public ExpenseCategory Category { get; }

        public Guid Id => Category.Id;

        public List<ExpenseCategory> Served { get; } = [];

        public IExpenseCategories Categories { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public RetireExpenseCategoryHandler Retire { get; }

        public ReactivateExpenseCategoryHandler Reactivate { get; }

        public DeleteExpenseCategoryHandler Delete { get; }

        private ExpenseCategory Build()
        {
            if (_others)
            {
                return ExpenseCategory.FromSeed(ExpenseCategorySeed.Rows.Single(row => row.Id == ExpenseCategorySeed.OthersId));
            }

            var category = ExpenseCategory.Create("Laundry", "info", Now).Value;
            if (_retired)
            {
                category.Retire(Now);
            }

            return category;
        }
    }
}

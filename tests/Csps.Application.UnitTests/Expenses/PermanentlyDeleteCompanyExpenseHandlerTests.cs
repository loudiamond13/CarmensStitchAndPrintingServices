using Csps.Application.Auth;
using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Expenses;
using NSubstitute;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>
/// CEXP-02, D-04, D-06, D-27: a permanent delete removes a live or soft-deleted expense in one transaction, writes the audit entry
/// first with the date, category, amount and payer and no text, and answers 404 for an unknown or already removed expense.
/// </summary>
public sealed class PermanentlyDeleteCompanyExpenseHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);
    private static readonly DateOnly Day = new(2026, 10, 25);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid PayerId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");
    private static readonly Guid CategoryId = Guid.Parse("447ad32e-1433-4b70-8786-72e3dc3f9937");

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Expenses.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnUnknownExpenseIsA404AndNothingIsRemovedOrAudited()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseErrors.NotFound);
        harness.Expenses.DidNotReceiveWithAnyArgs().Remove(default!);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ALiveOrSoftDeletedExpenseIsFoundIncludingDeletedAndRemovedWithOneSave(bool deleted)
    {
        var harness = new Harness();
        if (deleted)
        {
            harness.Expense.SoftDelete(CallerId, Now);
        }

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Expenses.Received(1).FindAsync(harness.Expense.Id, true, Arg.Any<CancellationToken>());
        harness.Expenses.Received(1).Remove(harness.Expense);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task TheAuditEntryIsRecordedBeforeTheRemoveAndBeforeTheSaveWithTheSnapshotOnly()
    {
        var harness = new Harness(description: "Zebra stripe fabric", notes: "Paid cash to Aling Nena");

        await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.CompanyExpensePermanentlyDeleted,
            "CompanyExpense",
            harness.Expense.Id.ToString("D"),
            $"date=2026-10-25;category={CategoryId:D};amount=640.00;payer={PayerId:D}",
            Independent: false));
        entry.RemovedBefore.ShouldBeFalse();
        entry.SavesBefore.ShouldBe(0);
        entry.Call.Detail.ShouldNotBeNull().ShouldNotContain("Zebra", Case.Insensitive);
        entry.Call.Detail.ShouldNotContain("Nena", Case.Insensitive);
    }

    [Fact]
    public async Task ALostRaceIsReadAgainAndDecidedAgain()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task ARaceThatLeavesNothingToRemoveIsA404()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();
        harness.Expenses.FindAsync(harness.Expense.Id, true, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<CompanyExpense?>(harness.Expense), Task.FromResult<CompanyExpense?>(null));

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseErrors.NotFound);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task TwoLostRacesAnswerBusy()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Commits.ShouldBe(0);
    }

    // Notes, for every entry, whether the remove and the save had already happened when it was recorded.
    private sealed class OrderAudit(ICompanyExpenses expenses, FakeUnitOfWork unit) : IAuditTrail
    {
        public List<(AuditCall Call, bool RemovedBefore, int SavesBefore)> Entries { get; } = [];

        public void Record(string action, string? targetType, string? targetId, string? detail) =>
            Entries.Add((
                new AuditCall(action, targetType, targetId, detail, Independent: false),
                expenses.ReceivedCalls().Any(call => call.GetMethodInfo().Name == nameof(ICompanyExpenses.Remove)),
                unit.Saves));

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken) =>
            throw new NotSupportedException("The expense audit entries must join the one save.");
    }

    private sealed class Harness
    {
        public Harness(bool noCaller = false, string description = "Thread and needles", string? notes = null)
        {
            Expense = CompanyExpense.Create(Day, CategoryId, description, 640.00m, PayerId, notes, Day, Now).Value;
            Expenses = Substitute.For<ICompanyExpenses>();
            Expenses.FindAsync(Expense.Id, true, Arg.Any<CancellationToken>()).Returns(Task.FromResult<CompanyExpense?>(Expense));
            Audit = new OrderAudit(Expenses, Unit);
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new PermanentlyDeleteCompanyExpenseHandler(Expenses, Audit, Unit, request);
        }

        public CompanyExpense Expense { get; }

        public ICompanyExpenses Expenses { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public OrderAudit Audit { get; }

        public PermanentlyDeleteCompanyExpenseHandler Handler { get; }
    }
}

using Csps.Application.Auth;
using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Expenses;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>
/// CEXP-02, D-01, D-27, D-31: a soft delete marks the Manager and the server time in one transaction with one audit entry, an unknown
/// or already deleted expense is a 404 that writes nothing, and a lost race is read again and decided again.
/// </summary>
public sealed class DeleteCompanyExpenseHandlerTests
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
    public async Task AnUnknownExpenseIsA404AndNothingIsWritten()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ALiveExpenseIsFoundWithoutDeletedOnesMarkedWithTheCallerAndTheClockAndSavedOnce()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Expenses.Received(1).FindAsync(harness.Expense.Id, false, Arg.Any<CancellationToken>());
        harness.Expense.IsDeleted.ShouldBeTrue();
        harness.Expense.DeletedById.ShouldBe(CallerId);
        harness.Expense.DeletedAtUtc.ShouldBe(harness.Time.GetUtcNow());
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(
            AuditActions.CompanyExpenseDeleted,
            "CompanyExpense",
            harness.Expense.Id.ToString("D"),
            $"date=2026-10-25;category={CategoryId:D};amount=640.00;payer={PayerId:D}",
            Independent: false));
    }

    [Fact]
    public async Task TheAuditDetailHoldsNoDescriptionOrNotes()
    {
        var harness = new Harness(description: "Zebra stripe fabric", notes: "Paid cash to Aling Nena");

        await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        var detail = harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldNotBeNull();
        detail.ShouldNotContain("Zebra", Case.Insensitive);
        detail.ShouldNotContain("Nena", Case.Insensitive);
    }

    [Fact]
    public async Task AnExpenseThatTurnsOutToBeDeletedAlreadyIsA404AndNothingIsWritten()
    {
        var harness = new Harness();
        harness.Expense.SoftDelete(Guid.NewGuid(), Now);

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ALostRaceIsReadAgainAndDecidedAgain()
    {
        var harness = new Harness(freshRowEachRead: true);
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task AFirstLostRaceThatLeavesNothingToDeleteIsA404()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();
        harness.Expenses.FindAsync(harness.Expense.Id, false, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<CompanyExpense?>(harness.Expense), Task.FromResult<CompanyExpense?>(null));

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseErrors.NotFound);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task TwoLostRacesAnswerBusy()
    {
        var harness = new Harness(freshRowEachRead: true);
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Commits.ShouldBe(0);
    }

    private sealed class Harness
    {
        public Harness(bool noCaller = false, string description = "Thread and needles", string? notes = null, bool freshRowEachRead = false)
        {
            Expense = CompanyExpense.Create(Day, CategoryId, description, 640.00m, PayerId, notes, Day, Now).Value;
            Expenses = Substitute.For<ICompanyExpenses>();
            Expenses.FindAsync(Expense.Id, false, Arg.Any<CancellationToken>()).Returns(_ =>
            {
                // A second pass reloads what is in the database, which is the live row again after a failed save.
                if (freshRowEachRead && Expense.IsDeleted)
                {
                    Expense.Restore();
                }

                return Task.FromResult<CompanyExpense?>(Expense);
            });
            Time = new FakeTimeProvider(Now.AddHours(1));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new DeleteCompanyExpenseHandler(Expenses, Audit, Unit, request, Time);
        }

        public CompanyExpense Expense { get; }

        public ICompanyExpenses Expenses { get; }

        public FakeTimeProvider Time { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public DeleteCompanyExpenseHandler Handler { get; }
    }
}

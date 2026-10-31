using Csps.Application.Auth;
using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Expenses;
using NSubstitute;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>
/// CEXP-02, D-03, D-27, D-31: a restore clears the delete marker in one transaction with one audit entry, restoring a live expense
/// writes and audits nothing, an unknown id is a 404, and a lost race is read again and decided again.
/// </summary>
public sealed class RestoreCompanyExpenseHandlerTests
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

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

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
    public async Task ALiveExpenseIsASuccessThatWritesAndAuditsNothing()
    {
        var harness = new Harness(deleted: false);

        var result = await harness.Handler.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Expenses.ReceivedCalls().Count().ShouldBe(1);
    }

    [Fact]
    public async Task ADeletedExpenseIsFoundIncludingDeletedClearedAndSavedOnceWithOneAuditEntry()
    {
        var harness = new Harness(deleted: true);

        var result = await harness.Handler.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Expenses.Received(1).FindAsync(harness.Id, true, Arg.Any<CancellationToken>());
        harness.Last.IsDeleted.ShouldBeFalse();
        harness.Last.DeletedById.ShouldBeNull();
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(
            AuditActions.CompanyExpenseRestored,
            "CompanyExpense",
            harness.Id.ToString("D"),
            $"date=2026-10-25;category={CategoryId:D};amount=640.00;payer={PayerId:D}",
            Independent: false));
    }

    [Fact]
    public async Task TheAuditDetailHoldsNoDescriptionOrNotes()
    {
        var harness = new Harness(deleted: true, description: "Zebra stripe fabric", notes: "Paid cash to Aling Nena");

        await harness.Handler.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        var detail = harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldNotBeNull();
        detail.ShouldNotContain("Zebra", Case.Insensitive);
        detail.ShouldNotContain("Nena", Case.Insensitive);
    }

    [Fact]
    public async Task ALostRaceIsReadAgainAndDecidedAgain()
    {
        var harness = new Harness(deleted: true);
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task TwoLostRacesAnswerBusy()
    {
        var harness = new Harness(deleted: true);
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Rollbacks.ShouldBe(2);
        harness.Unit.Commits.ShouldBe(0);
    }

    private sealed class Harness
    {
        public Harness(bool noCaller = false, bool? deleted = null, string description = "Thread and needles", string? notes = null)
        {
            Expenses = Substitute.For<ICompanyExpenses>();
            Last = CompanyExpense.Create(Day, CategoryId, description, 640.00m, PayerId, notes, Day, Now).Value;
            Id = Last.Id;
            if (deleted is { } isDeleted)
            {
                // Every read starts from the stored state again, as a real second pass reloads what is in the database.
                Expenses.FindAsync(Id, Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (isDeleted && !Last.IsDeleted)
                    {
                        Last.SoftDelete(CallerId, Now);
                    }

                    return Task.FromResult<CompanyExpense?>(Last);
                });
            }

            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new RestoreCompanyExpenseHandler(Expenses, Audit, Unit, request);
        }

        public Guid Id { get; }

        public CompanyExpense Last { get; }

        public ICompanyExpenses Expenses { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public RestoreCompanyExpenseHandler Handler { get; }
    }
}

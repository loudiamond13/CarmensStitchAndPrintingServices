using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>
/// CEXP-02, SEC-07, D-11, D-26, OQ-7, D-32: the edit handler runs its steps in one order (form 400, then 404, then 403, then 409, then
/// the changed category and payer 400), saves once in one transaction, never retries a conflict, and writes nothing for an unchanged form.
/// </summary>
public sealed class UpdateCompanyExpenseHandlerTests
{
    // 2026-10-25 04:30 in the fixed UTC+8 zone.
    private static readonly DateTimeOffset Now = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid RecorderId = Guid.Parse("2d6f9a41-8b17-4e53-a0c2-6e4b8d1f7a35");
    private static readonly Guid PayerId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");
    private static readonly Guid NewPayerId = Guid.Parse("a1c3e5f7-2b4d-4968-8a0c-1e3f5a7b9d02");
    private static readonly Guid CategoryId = Guid.Parse("447ad32e-1433-4b70-8786-72e3dc3f9937");
    private static readonly Guid NewCategoryId = Guid.Parse("0f4b8d27-6a31-4c95-9e02-5d7a1c3b8e46");
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 0x1F, 0xA4];
    private static readonly string StoredVersionText = RowVersions.ToText(StoredVersion);
    private static readonly string StaleVersionText = RowVersions.ToText([0, 0, 0, 0, 0, 0, 0x1F, 0xA3]);

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Expenses.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ABadFormIsA400BeforeAnythingIsLookedUp()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid() with { Amount = 0m, Version = "nope" }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("company-expenses.invalid-request");
        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "version"]);
        await harness.Expenses.DidNotReceiveWithAnyArgs().FindAsync(default, default, TestContext.Current.CancellationToken);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnUnknownOrDeletedExpenseIsA404()
    {
        var harness = new Harness();
        harness.Expenses.FindAsync(Arg.Any<Guid>(), false, Arg.Any<CancellationToken>()).Returns(Task.FromResult<CompanyExpense?>(null));

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnAdminWhoNeitherRecordedNorPaidGets403EvenWithAStaleVersion()
    {
        var harness = new Harness(callerRole: Roles.Admin);

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid() with { Version = StaleVersionText }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseErrors.NotYours);
        result.Error.Kind.ShouldBe(ErrorKind.Forbidden);
        harness.Unit.Saves.ShouldBe(0);
        await harness.Categories.DidNotReceiveWithAnyArgs().GetStateAsync(default, TestContext.Current.CancellationToken);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task AnAdminWhoRecordedOrPaidMayEdit(bool recorded, bool paid)
    {
        var harness = new Harness(callerRole: Roles.Admin, recordedBy: recorded ? CallerId : RecorderId, paidBy: paid ? CallerId : PayerId);

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid(paidBy: paid ? CallerId : PayerId) with { Amount = 700m }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task AStaleVersionIs409EvenWhenTheNewPayerCouldNotBeChosen()
    {
        var harness = new Harness();
        harness.Staff.GetStaffStateAsync(NewPayerId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<StaffState?>(null));

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid(paidBy: NewPayerId) with { Version = StaleVersionText }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        harness.Unit.Saves.ShouldBe(0);
        harness.Expense.Amount.ShouldBe(640.00m);
        await harness.Staff.DidNotReceive().GetStaffStateAsync(NewPayerId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AChangedPayerWhoCannotPayIsA400OnThePayerFieldAndNothingIsSaved()
    {
        var harness = new Harness();
        harness.Staff.GetStaffStateAsync(NewPayerId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<StaffState?>(new StaffState(NewPayerId, "Dee Dizon", Roles.Admin, false, false, false, true)));

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid(paidBy: NewPayerId) with { Amount = 5m }, TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["paidByUserId"]);
        result.Error.FieldErrors["paidByUserId"].ShouldBe([ExpenseRules.PaidByInactive]);
        harness.Unit.Saves.ShouldBe(0);
        harness.Expense.Amount.ShouldBe(640.00m);
        harness.Expense.PaidByUserId.ShouldBe(PayerId);
    }

    [Fact]
    public async Task AnUnchangedPayerWhoCannotPayAnymoreStaysAndIsNotLookedUp()
    {
        var harness = new Harness();
        harness.Staff.GetStaffStateAsync(PayerId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<StaffState?>(new StaffState(PayerId, "Mina Mercado", Roles.Admin, false, false, false, true)));

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid() with { Amount = 5m }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
        await harness.Staff.DidNotReceive().GetStaffStateAsync(PayerId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AChangedRetiredCategoryIsA400AndAKeptRetiredCategoryIsAccepted()
    {
        var harness = new Harness();
        harness.Categories.GetStateAsync(NewCategoryId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<ExpenseCategoryState?>(new ExpenseCategoryState(NewCategoryId, "Old", Retired: true)));
        harness.Categories.GetStateAsync(CategoryId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<ExpenseCategoryState?>(new ExpenseCategoryState(CategoryId, "Supplies", Retired: true)));

        var refused = await harness.Handler.HandleAsync(harness.Expense.Id, Valid(category: NewCategoryId), TestContext.Current.CancellationToken);
        var kept = await harness.Handler.HandleAsync(harness.Expense.Id, Valid() with { Amount = 9m }, TestContext.Current.CancellationToken);

        refused.Error.FieldErrors.ShouldNotBeNull()["categoryId"].ShouldBe([ExpenseRules.CategoryRetired]);
        kept.IsSuccess.ShouldBeTrue();
        await harness.Categories.DidNotReceive().GetStateAsync(CategoryId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AChangedUnknownCategoryIsTheChooseMessage()
    {
        var harness = new Harness();
        harness.Categories.GetStateAsync(NewCategoryId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<ExpenseCategoryState?>(null));

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid(category: NewCategoryId), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull()["categoryId"].ShouldBe([ExpenseRules.CategoryRequired]);
    }

    [Fact]
    public async Task AnUnchangedFormSavesNothingAndReturnsTheCurrentDetail()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Version.ShouldBe(StoredVersionText);
        harness.Unit.Saves.ShouldBe(0);
        await harness.Reader.Received(1).GetDetailAsync(harness.Expense.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ASuccessSavesOnceInOneTransactionWithTheTrimmedValues()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(
            harness.Expense.Id,
            Valid() with { Description = "  New words  ", Notes = "  cash  ", Amount = 1250.10m },
            TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Expense.Description.ShouldBe("New words");
        harness.Expense.Notes.ShouldBe("cash");
        harness.Expense.Amount.ShouldBe(1250.10m);
    }

    [Fact]
    public async Task ALostRaceAtSaveIs409AndIsNeverRetried()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid() with { Amount = 5m }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task ACategoryDeletedBetweenTheCheckAndTheSaveIsRefusedLikeAnUnknownOne()
    {
        var harness = new Harness();
        harness.Unit.ThrowOnSave(new CategoryDeletedException());

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid() with { Amount = 5m }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["categoryId"]);
        result.Error.FieldErrors["categoryId"].ShouldBe(["Choose a category."]);
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task AnExpenseTheReaderCannotFindAfterTheSaveIsA404()
    {
        var harness = new Harness();
        harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<CompanyExpenseDetailView?>(null));

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid() with { Amount = 5m }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseErrors.NotFound);
    }

    [Fact]
    public async Task TheAnswerCarriesTheEditRightAfterTheSave()
    {
        var harness = new Harness(callerRole: Roles.Admin, recordedBy: RecorderId, paidBy: CallerId, detailPaidBy: PayerId);

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid(paidBy: PayerId), TestContext.Current.CancellationToken);

        // The reader shows the payer moved away from the Admin on a row someone else recorded, so the Admin can no longer edit it.
        result.Value.CanEdit.ShouldBeFalse();
    }

    [Fact]
    public async Task AnAmountAndDescriptionEditWritesOneChangedEntryWithOldAndNewAmountAndNoText()
    {
        var harness = new Harness(amount: 1200.00m);

        var result = await harness.Handler.HandleAsync(
            harness.Expense.Id,
            Valid() with { Amount = 1250.00m, Description = "Private supplier detail" },
            TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.CompanyExpenseChanged,
            "CompanyExpense",
            harness.Expense.Id.ToString("D"),
            $"amount=1200.00>1250.00;fields=description;payer={PayerId:D}",
            Independent: false));
        entry.SavesSoFar.ShouldBe(0);
        harness.Unit.Saves.ShouldBe(1);
        entry.Call.Detail.ShouldNotBeNull().ShouldNotContain("Private", Case.Insensitive);
    }

    [Fact]
    public async Task APayerOnlyChangeWritesOnlyAPayerChangedEntry()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid(paidBy: NewPayerId), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.CompanyExpensePayerChanged,
            "CompanyExpense",
            harness.Expense.Id.ToString("D"),
            $"payer={PayerId:D}>{NewPayerId:D}",
            Independent: false));
        entry.SavesSoFar.ShouldBe(0);
    }

    [Fact]
    public async Task APayerAndDateChangeWritesTwoSeparateEntriesTheChangedOneEndingWithTheNewPayer()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Expense.Id, Valid(paidBy: NewPayerId) with { Date = "2026-10-20" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.Select(entry => entry.Call.Action).ShouldBe([AuditActions.CompanyExpenseChanged, AuditActions.CompanyExpensePayerChanged]);
        harness.Audit.Entries[0].Call.Detail.ShouldBe($"date=2026-10-25>2026-10-20;payer={NewPayerId:D}");
        harness.Audit.Entries[1].Call.Detail.ShouldBe($"payer={PayerId:D}>{NewPayerId:D}");
        harness.Audit.Entries.ShouldAllBe(entry => entry.SavesSoFar == 0);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ADescriptionAndNotesChangeNamesBothFieldsAndNeverTheirText()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(
            harness.Expense.Id,
            Valid() with { Description = "Zebra stripe fabric", Notes = "Paid cash to Aling Nena" },
            TestContext.Current.CancellationToken);

        var detail = harness.Audit.Entries.ShouldHaveSingleItem().Call.Detail.ShouldNotBeNull();
        detail.ShouldBe($"fields=description,notes;payer={PayerId:D}");
        detail.ShouldNotContain("Zebra", Case.Insensitive);
        detail.ShouldNotContain("Nena", Case.Insensitive);
    }

    [Fact]
    public async Task ACategoryChangeIsRecordedWithBothIds()
    {
        var harness = new Harness();
        harness.Categories.GetStateAsync(NewCategoryId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<ExpenseCategoryState?>(new ExpenseCategoryState(NewCategoryId, "Rent", Retired: false)));

        await harness.Handler.HandleAsync(harness.Expense.Id, Valid(category: NewCategoryId), TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Call.Detail.ShouldBe($"category={CategoryId:D}>{NewCategoryId:D};payer={PayerId:D}");
    }

    [Fact]
    public async Task AnUnchangedFormAndEveryRefusalRecordNothing()
    {
        var harness = new Harness();
        var admin = new Harness(callerRole: Roles.Admin);

        await harness.Handler.HandleAsync(harness.Expense.Id, Valid(), TestContext.Current.CancellationToken);
        await harness.Handler.HandleAsync(harness.Expense.Id, Valid() with { Amount = 0m }, TestContext.Current.CancellationToken);
        await harness.Handler.HandleAsync(harness.Expense.Id, Valid() with { Version = StaleVersionText, Amount = 5m }, TestContext.Current.CancellationToken);
        await admin.Handler.HandleAsync(admin.Expense.Id, Valid() with { Amount = 5m }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldBeEmpty();
        admin.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public void TheChangedDetailListsAmountDateAndCategoryThenFieldNamesThenThePayer()
    {
        var other = Guid.Parse("11111111-2222-4333-8444-555555555555");
        var changes = new ExpenseChanges(
            new ValueChange<decimal>(1200.00m, 1250.5m),
            new ValueChange<DateOnly>(new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 2)),
            new ValueChange<Guid>(CategoryId, other),
            null,
            DescriptionChanged: true,
            NotesChanged: true);

        var detail = ExpenseAuditDetail.Changes(changes, PayerId);

        detail.ShouldBe($"amount=1200.00>1250.50;date=2026-10-01>2026-10-02;category={CategoryId:D}>{other:D};fields=description,notes;payer={PayerId:D}");
        detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public void ThePayerChangeDetailNamesBothIdsInOrder()
    {
        ExpenseAuditDetail.PayerChange(PayerId, NewPayerId).ShouldBe($"payer={PayerId:D}>{NewPayerId:D}");
    }

    private static UpdateCompanyExpenseRequest Valid(Guid? paidBy = null, Guid? category = null) =>
        new("2026-10-25", category ?? CategoryId, "Thread and needles", 640.00m, paidBy ?? PayerId, null, StoredVersionText);

    private sealed class Harness
    {
        public Harness(bool noCaller = false, string callerRole = Roles.Manager, Guid? recordedBy = null, Guid? paidBy = null, Guid? detailPaidBy = null, decimal amount = 640.00m)
        {
            Audit = new SaveAwareAudit(Unit);
            var created = CompanyExpense.Create(new DateOnly(2026, 10, 25), CategoryId, "Thread and needles", amount, paidBy ?? PayerId, null, new DateOnly(2026, 10, 25), Now);
            Expense = created.Value;
            typeof(CompanyExpense).GetProperty(nameof(CompanyExpense.CreatedById), BindingFlags.Public | BindingFlags.Instance)!.SetValue(Expense, recordedBy ?? RecorderId);
            typeof(CompanyExpense).GetProperty(nameof(CompanyExpense.RowVersion), BindingFlags.Public | BindingFlags.Instance)!.SetValue(Expense, StoredVersion);

            Expenses = Substitute.For<ICompanyExpenses>();
            Expenses.FindAsync(Expense.Id, false, Arg.Any<CancellationToken>()).Returns(Task.FromResult<CompanyExpense?>(Expense));
            Reader = Substitute.For<ICompanyExpenseReader>();
            Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult<CompanyExpenseDetailView?>(Detail(call.Arg<Guid>(), detailPaidBy ?? Expense.PaidByUserId, recordedBy ?? RecorderId)));
            Categories = Substitute.For<IExpenseCategories>();
            Staff = Substitute.For<IStaffDirectory>();
            Staff.GetStaffStateAsync(CallerId, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<StaffState?>(new StaffState(CallerId, "Paolo Reyes", callerRole, true, false, false, true)));
            Staff.GetStaffStateAsync(NewPayerId, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<StaffState?>(new StaffState(NewPayerId, "Dee Dizon", Roles.Admin, true, false, false, true)));
            Staff.GetStaffStateAsync(PayerId, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<StaffState?>(new StaffState(PayerId, "Mina Mercado", Roles.Admin, true, false, false, true)));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new UpdateCompanyExpenseHandler(Expenses, Reader, Categories, Staff, new FixedCalendar(), Audit, Unit, request, new UpdateCompanyExpenseRequestValidator());
        }

        public CompanyExpense Expense { get; }

        public ICompanyExpenses Expenses { get; }

        public ICompanyExpenseReader Reader { get; }

        public IExpenseCategories Categories { get; }

        public IStaffDirectory Staff { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public SaveAwareAudit Audit { get; }

        public UpdateCompanyExpenseHandler Handler { get; }

        private static CompanyExpenseDetailView Detail(Guid id, Guid payerId, Guid recorderId) => new(
            id,
            new DateOnly(2026, 10, 25),
            new ExpenseCategoryRef(CategoryId, "Supplies", "warning", false),
            "Thread and needles",
            640.00m,
            null,
            new ActorRef(payerId, "Mina Mercado", false),
            true,
            new ActorRef(recorderId, "Abel Aquino", false),
            Now,
            null,
            null,
            StoredVersion,
            recorderId,
            payerId);
    }

    // Remembers how many saves had happened when each entry was recorded, so a test can prove each entry joins the one save.
    private sealed class SaveAwareAudit(FakeUnitOfWork unit) : IAuditTrail
    {
        public List<(AuditCall Call, int SavesSoFar)> Entries { get; } = [];

        public void Record(string action, string? targetType, string? targetId, string? detail) =>
            Entries.Add((new AuditCall(action, targetType, targetId, detail, Independent: false), unit.Saves));

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken) =>
            throw new NotSupportedException("The expense audit entries must join the one save.");
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}

using System.Reflection;
using Csps.Application.Common;
using Csps.Application.ExpenseCategories;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Expenses;
using NSubstitute;

namespace Csps.Application.UnitTests.ExpenseCategories;

/// <summary>
/// CEXP-02, D-12, D-13, D-27, SEC-07, OQ-6, OQ-10: the edit handler runs its steps in one order (form 400, then 404, then 409, then
/// the Others and name checks 400), saves once in one transaction, never retries a conflict, and writes nothing for an unchanged form.
/// </summary>
public sealed class UpdateExpenseCategoryHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);
    private static readonly Guid ChangerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 0x1F, 0xA4];
    private static readonly string StoredVersionText = RowVersions.ToText(StoredVersion);
    private static readonly string StaleVersionText = RowVersions.ToText([0, 0, 0, 0, 0, 0, 0x1F, 0xA3]);

    [Fact]
    public void TheOthersNameMessageIsTheDomainsMessage()
    {
        ExpenseCategoryRules.OthersNameLocked.ShouldBe(ExpenseCategory.OthersNameMessage);
    }

    [Fact]
    public async Task ABadFormIsA400BeforeAnythingIsLookedUp()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Category.Id, new UpdateExpenseCategoryRequest(" ", "danger", "nope"), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("expense-categories.invalid-request");
        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order(StringComparer.Ordinal).ShouldBe(["name", "tone", "version"]);
        await harness.Categories.DidNotReceiveWithAnyArgs().FindAsync(default, TestContext.Current.CancellationToken);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnUnknownCategoryIsA404()
    {
        var harness = new Harness(found: false);

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseCategoryErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AStaleVersionIs409AndNothingIsChecked()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Category.Id, Valid() with { Version = StaleVersionText, Name = "Office" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        await harness.Categories.DidNotReceiveWithAnyArgs().NameTakenAsync(default!, default, TestContext.Current.CancellationToken);
        harness.Category.Name.ShouldBe("Supplies");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ARenameAndARecolorSaveOnceAndWriteTwoAuditEntriesInOrder()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Category.Id, Valid() with { Name = " Office supplies ", Tone = "success" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Category.Name.ShouldBe("Office supplies");
        harness.Category.Tone.ShouldBe("success");
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        var key = harness.Category.Id.ToString("D");
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.ExpenseCategoryRenamed, "ExpenseCategory", key, "name=Supplies>Office supplies", Independent: false),
            new AuditCall(AuditActions.ExpenseCategoryRecolored, "ExpenseCategory", key, "tone=warning>success", Independent: false),
        ]);
        await harness.Categories.Received(1).NameTakenAsync("OFFICE SUPPLIES", harness.Category.Id, Arg.Any<CancellationToken>());
        result.Value.Name.ShouldBe("Supplies detail");
    }

    [Fact]
    public async Task ARenameAloneWritesOnlyTheRenamedEntryWithEncodedNames()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(harness.Category.Id, Valid() with { Name = "Pens; ink=blue" }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(
            AuditActions.ExpenseCategoryRenamed, "ExpenseCategory", harness.Category.Id.ToString("D"), "name=Supplies>Pens%3B ink%3Dblue", Independent: false));
    }

    [Fact]
    public async Task ARecolorAloneWritesOnlyTheRecoloredEntryAndSkipsTheNameLookup()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(harness.Category.Id, Valid() with { Tone = "neutral" }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Action.ShouldBe(AuditActions.ExpenseCategoryRecolored);
        await harness.Categories.DidNotReceiveWithAnyArgs().NameTakenAsync(default!, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task AChangeOfLetterCaseOnlyIsARenameThatKeepsItsOwnName()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Category.Id, Valid() with { Name = "SUPPLIES" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Category.Name.ShouldBe("SUPPLIES");
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("name=Supplies>SUPPLIES");
        await harness.Categories.DidNotReceiveWithAnyArgs().NameTakenAsync(default!, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task AFormWithNoChangeSavesNothingAndAuditsNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Category.Id, Valid(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ANameAnotherCategoryHoldsIsAFieldError()
    {
        var harness = new Harness(nameTaken: true);

        var result = await harness.Handler.HandleAsync(harness.Category.Id, Valid() with { Name = "Rent" }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["name"].ShouldBe(["Another category already has this name."]);
        harness.Category.Name.ShouldBe("Supplies");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task OthersCannotBeRenamedAndNothingChanges()
    {
        var harness = new Harness(others: true);

        var result = await harness.Handler.HandleAsync(harness.Category.Id, Valid() with { Name = "Misc", Tone = "success" }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["name"].ShouldBe(["The Others name can't change."]);
        harness.Category.Name.ShouldBe("Others");
        harness.Category.Tone.ShouldBe("neutral");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task OthersKeepsItsNameAndCanBeRecolored()
    {
        var harness = new Harness(others: true);

        var result = await harness.Handler.HandleAsync(harness.Category.Id, Valid() with { Name = "Others", Tone = "success" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Category.Tone.ShouldBe("success");
        harness.Audit.Entries.ShouldHaveSingleItem().Action.ShouldBe(AuditActions.ExpenseCategoryRecolored);
        await harness.Categories.DidNotReceiveWithAnyArgs().NameTakenAsync(default!, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ALostVersionRaceAtSaveIsA409AndIsNotRetried()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Category.Id, Valid() with { Tone = "neutral" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task ALostNameRaceAtSaveIsTheNameFieldError()
    {
        var harness = new Harness();
        harness.Unit.ThrowOnSave(new CategoryNameTakenException());

        var result = await harness.Handler.HandleAsync(harness.Category.Id, Valid() with { Name = "Office" }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["name"].ShouldBe(["Another category already has this name."]);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task ACategoryThatVanishesBeforeTheFinalReadIsA404()
    {
        var harness = new Harness(detailMissing: true);

        var result = await harness.Handler.HandleAsync(harness.Category.Id, Valid() with { Tone = "neutral" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseCategoryErrors.NotFound);
    }

    private static UpdateExpenseCategoryRequest Valid() => new("Supplies", "warning", StoredVersionText);

    private sealed class Harness
    {
        public Harness(bool found = true, bool nameTaken = false, bool others = false, bool detailMissing = false)
        {
            Category = others
                ? ExpenseCategory.FromSeed(ExpenseCategorySeed.Rows.Single(row => row.Id == ExpenseCategorySeed.OthersId))
                : ExpenseCategory.Create("Supplies", "warning", Now).Value;
            typeof(ExpenseCategory).GetProperty(nameof(ExpenseCategory.RowVersion), BindingFlags.Public | BindingFlags.Instance)!.SetValue(Category, StoredVersion);

            Categories = Substitute.For<IExpenseCategories>();
            Categories.FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<ExpenseCategory?>(found ? Category : null));
            Categories.NameTakenAsync(Arg.Any<string>(), Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(nameTaken);
            Categories.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult<ExpenseCategoryDetailView?>(detailMissing ? null : Detail(call.Arg<Guid>())));
            Handler = new UpdateExpenseCategoryHandler(Categories, Audit, Unit, new UpdateExpenseCategoryRequestValidator());
        }

        public ExpenseCategory Category { get; }

        public IExpenseCategories Categories { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public UpdateExpenseCategoryHandler Handler { get; }

        private static ExpenseCategoryDetailView Detail(Guid id) => new(
            id,
            "Supplies detail",
            "success",
            Retired: false,
            IsOthers: false,
            ExpenseCount: 2,
            RecordedBy: null,
            CreatedAtUtc: Now,
            LastChangedBy: new ActorRef(ChangerId, "Paolo Reyes", false),
            UpdatedAtUtc: Now.AddHours(1),
            RowVersion: [0, 0, 0, 0, 0, 0, 0x1F, 0xA5]);
    }
}

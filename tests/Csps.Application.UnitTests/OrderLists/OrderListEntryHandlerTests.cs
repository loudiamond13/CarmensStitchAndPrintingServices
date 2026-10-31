using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.OrderLists;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;
using FluentValidation;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.OrderLists;

/// <summary>
/// D-19, D-31, SEC-07, Pitfall 7: the generic list handlers add, read, edit, retire, bring back and delete entries of all three
/// lists under the Phase 6 category rules. Edits run their steps in one order and never retry a conflict; single clicks act on the
/// latest state; every change writes one audit entry in the same save; Others is protected; a used entry can only be retired.
/// </summary>
public sealed class OrderListEntryHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 20, 30, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = Now.AddHours(1);
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 0x1F, 0xA4];
    private static readonly string StoredVersionText = RowVersions.ToText(StoredVersion);
    private static readonly string StaleVersionText = RowVersions.ToText([0, 0, 0, 0, 0, 0, 0x1F, 0xA3]);

    public static TheoryData<OrderListKind> Kinds => [OrderListKind.ProductType, OrderListKind.PaymentMethod, OrderListKind.OrderExpenseCategory];

    [Theory]
    [MemberData(nameof(Kinds))]
    public async Task AddingABadFormIs400WithTheListsNounAndNothingIsLookedUpOrWritten(OrderListKind kind)
    {
        var harness = new Harness(kind);

        var result = await harness.Create.HandleAsync(kind, new OrderListEntryRequest(" ", "danger", null), TestContext.Current.CancellationToken);

        var descriptor = OrderListDescriptor.For(kind);
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe(descriptor.InvalidCode);
        result.Error.Message.ShouldBe("Check the highlighted fields.");
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields["name"].ShouldBe([$"Enter a {descriptor.Noun} name."]);
        fields["tone"].ShouldBe(["Choose a badge color."]);
        fields.ContainsKey("version").ShouldBeFalse();
        await harness.Lists.DidNotReceiveWithAnyArgs().NameTakenAsync(default, default!, default, TestContext.Current.CancellationToken);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddingANameAnotherEntryHoldsIsAFieldErrorOnName()
    {
        var harness = new Harness(OrderListKind.PaymentMethod, nameTaken: true);

        var result = await harness.Create.HandleAsync(OrderListKind.PaymentMethod, new OrderListEntryRequest(" cash ", "info", null), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull()["name"].ShouldBe(["That name is already used. Choose another one."]);
        await harness.Lists.Received(1).NameTakenAsync(OrderListKind.PaymentMethod, "CASH", null, Arg.Any<CancellationToken>());
        harness.Lists.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Theory]
    [InlineData(OrderListKind.ProductType, "product-type.added", "ProductType")]
    [InlineData(OrderListKind.PaymentMethod, "payment-method.added", "PaymentMethod")]
    [InlineData(OrderListKind.OrderExpenseCategory, "order-expense-category.added", "OrderExpenseCategory")]
    public async Task AddingSavesOnceInOneTransactionWithOneAuditEntryAndReturnsTheDetail(OrderListKind kind, string action, string target)
    {
        var harness = new Harness(kind);

        var result = await harness.Create.HandleAsync(kind, new OrderListEntryRequest(" Hoodie; fleece ", "info", null), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Name.ShouldBe("Entry detail");
        var added = harness.Added.ShouldHaveSingleItem();
        added.Name.ShouldBe("Hoodie; fleece");
        added.Tone.ShouldBe("info");
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(action, target, added.Id.ToString("D"), "name=Hoodie%3B fleece;tone=info", Independent: false));
        await harness.Lists.Received(1).NameTakenAsync(kind, "HOODIE; FLEECE", null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddingThatLosesTheNameRaceIsTheSameFieldErrorAndRollsBack()
    {
        var harness = new Harness(OrderListKind.ProductType);
        harness.Unit.ThrowOnSave(new OrderListNameTakenException());

        var result = await harness.Create.HandleAsync(OrderListKind.ProductType, new OrderListEntryRequest("Hoodie", "info", null), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["name"].ShouldBe(["That name is already used. Choose another one."]);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Theory]
    [InlineData(OrderListKind.ProductType)]
    [InlineData(OrderListKind.PaymentMethod)]
    [InlineData(OrderListKind.OrderExpenseCategory)]
    public async Task AddingThatLosesADeadlockIsA409LikeTheOtherWritesAndIsNotRetried(OrderListKind kind)
    {
        var harness = new Harness(kind);
        harness.Unit.ThrowOnSave(new ConcurrencyConflictException(new InvalidOperationException("A deadlock victim.")));

        var result = await harness.Create.HandleAsync(kind, new OrderListEntryRequest("Hoodie", "info", null), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task AnEntryThatVanishesBeforeTheFinalReadIsA404()
    {
        var harness = new Harness(OrderListKind.ProductType, detailMissing: true);

        var result = await harness.Create.HandleAsync(OrderListKind.ProductType, new OrderListEntryRequest("Hoodie", "info", null), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("product-types.not-found");
    }

    [Fact]
    public async Task ReadingAnEntryMapsTheDetailAndAMissingOneIsA404WithTheListsMessage()
    {
        var harness = new Harness(OrderListKind.PaymentMethod);
        var id = Guid.NewGuid();

        var found = await harness.Get.HandleAsync(OrderListKind.PaymentMethod, id, TestContext.Current.CancellationToken);

        found.IsSuccess.ShouldBeTrue();
        found.Value.Id.ShouldBe(id);
        found.Value.Status.ShouldBe("active");
        found.Value.UseCount.ShouldBe(2);
        found.Value.RecordedAt.ShouldBe(Now);
        found.Value.LastChangedBy.ShouldNotBeNull().Name.ShouldBe("Paolo Reyes");
        found.Value.Version.ShouldBe(RowVersions.ToText([0, 0, 0, 0, 0, 0, 0x1F, 0xA5]));

        var missing = await new Harness(OrderListKind.PaymentMethod, detailMissing: true).Get.HandleAsync(OrderListKind.PaymentMethod, id, TestContext.Current.CancellationToken);

        missing.Error.Code.ShouldBe("payment-methods.not-found");
        missing.Error.Message.ShouldBe("This payment method was deleted.");
    }

    [Fact]
    public async Task ARetiredEntryReadsAsRetired()
    {
        var harness = new Harness(OrderListKind.ProductType, detailRetired: true);

        var result = await harness.Get.HandleAsync(OrderListKind.ProductType, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Value.Status.ShouldBe("retired");
    }

    [Fact]
    public async Task ABadEditFormIs400BeforeAnythingIsLookedUp()
    {
        var harness = new Harness(OrderListKind.ProductType);

        var result = await harness.Update.HandleAsync(OrderListKind.ProductType, harness.Id, new OrderListEntryRequest(" ", "danger", "nope"), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order(StringComparer.Ordinal).ShouldBe(["name", "tone", "version"]);
        await harness.Lists.DidNotReceiveWithAnyArgs().FindAsync(default, default, TestContext.Current.CancellationToken);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task EditingAnUnknownEntryIsA404()
    {
        var harness = new Harness(OrderListKind.OrderExpenseCategory, found: false);

        var result = await harness.Update.HandleAsync(OrderListKind.OrderExpenseCategory, Guid.NewGuid(), Valid(), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("order-expense-categories.not-found");
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AStaleVersionIs409AndNothingIsChecked()
    {
        var harness = new Harness(OrderListKind.ProductType);

        var result = await harness.Update.HandleAsync(OrderListKind.ProductType, harness.Id, Valid() with { Version = StaleVersionText, Name = "Office" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        await harness.Lists.DidNotReceiveWithAnyArgs().NameTakenAsync(default, default!, default, TestContext.Current.CancellationToken);
        harness.Entry.Name.ShouldBe("Supplies");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ARenameAndARecolorSaveOnceAndWriteTwoAuditEntriesInOrder()
    {
        var harness = new Harness(OrderListKind.PaymentMethod);

        var result = await harness.Update.HandleAsync(OrderListKind.PaymentMethod, harness.Id, Valid() with { Name = " Office supplies ", Tone = "success" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Entry.Name.ShouldBe("Office supplies");
        harness.Entry.Tone.ShouldBe("success");
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        var key = harness.Id.ToString("D");
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.PaymentMethodRenamed, "PaymentMethod", key, "name=Supplies>Office supplies", Independent: false),
            new AuditCall(AuditActions.PaymentMethodRecolored, "PaymentMethod", key, "tone=warning>success", Independent: false),
        ]);
        await harness.Lists.Received(1).NameTakenAsync(OrderListKind.PaymentMethod, "OFFICE SUPPLIES", harness.Id, Arg.Any<CancellationToken>());
        result.Value.Name.ShouldBe("Entry detail");
    }

    [Fact]
    public async Task ARenameAloneWritesOnlyTheRenamedEntryWithEncodedNames()
    {
        var harness = new Harness(OrderListKind.ProductType);

        await harness.Update.HandleAsync(OrderListKind.ProductType, harness.Id, Valid() with { Name = "Pens; ink=blue" }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(
            AuditActions.ProductTypeRenamed, "ProductType", harness.Id.ToString("D"), "name=Supplies>Pens%3B ink%3Dblue", Independent: false));
    }

    [Fact]
    public async Task ARecolorAloneWritesOnlyTheRecoloredEntryAndSkipsTheNameLookup()
    {
        var harness = new Harness(OrderListKind.OrderExpenseCategory);

        await harness.Update.HandleAsync(OrderListKind.OrderExpenseCategory, harness.Id, Valid() with { Tone = "neutral" }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Action.ShouldBe(AuditActions.OrderExpenseCategoryRecolored);
        await harness.Lists.DidNotReceiveWithAnyArgs().NameTakenAsync(default, default!, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task AChangeOfLetterCaseOnlyIsARenameThatKeepsItsOwnName()
    {
        var harness = new Harness(OrderListKind.ProductType);

        var result = await harness.Update.HandleAsync(OrderListKind.ProductType, harness.Id, Valid() with { Name = "SUPPLIES" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Entry.Name.ShouldBe("SUPPLIES");
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("name=Supplies>SUPPLIES");
        await harness.Lists.DidNotReceiveWithAnyArgs().NameTakenAsync(default, default!, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task AFormWithNoChangeSavesNothingAndAuditsNothing()
    {
        var harness = new Harness(OrderListKind.ProductType);

        var result = await harness.Update.HandleAsync(OrderListKind.ProductType, harness.Id, Valid(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ANameAnotherEntryHoldsIsAFieldErrorOnName()
    {
        var harness = new Harness(OrderListKind.ProductType, nameTaken: true);

        var result = await harness.Update.HandleAsync(OrderListKind.ProductType, harness.Id, Valid() with { Name = "Polo Shirt" }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("product-types.invalid-request");
        result.Error.FieldErrors.ShouldNotBeNull()["name"].ShouldBe(["That name is already used. Choose another one."]);
        harness.Entry.Name.ShouldBe("Supplies");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task RenamingOthersIsA400OnNameLikePhase6AndNothingChanges()
    {
        var harness = new Harness(OrderListKind.OrderExpenseCategory, others: true);

        var result = await harness.Update.HandleAsync(OrderListKind.OrderExpenseCategory, harness.Id, Valid() with { Name = "Misc", Tone = "success" }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("order-expense-categories.invalid-request");
        result.Error.FieldErrors.ShouldNotBeNull()["name"].ShouldBe(["The Others name can't change."]);
        harness.Entry.Name.ShouldBe("Others");
        harness.Entry.Tone.ShouldBe("neutral");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task OthersKeepsItsNameAndCanBeRecolored()
    {
        var harness = new Harness(OrderListKind.OrderExpenseCategory, others: true);

        var result = await harness.Update.HandleAsync(OrderListKind.OrderExpenseCategory, harness.Id, Valid() with { Name = " Others ", Tone = "success" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Entry.Tone.ShouldBe("success");
        harness.Audit.Entries.ShouldHaveSingleItem().Action.ShouldBe(AuditActions.OrderExpenseCategoryRecolored);
        await harness.Lists.DidNotReceiveWithAnyArgs().NameTakenAsync(default, default!, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ALostVersionRaceAtSaveIsA409AndIsNotRetried()
    {
        var harness = new Harness(OrderListKind.ProductType);
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Update.HandleAsync(OrderListKind.ProductType, harness.Id, Valid() with { Tone = "neutral" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task ALostNameRaceAtSaveIsTheNameFieldError()
    {
        var harness = new Harness(OrderListKind.ProductType);
        harness.Unit.ThrowOnSave(new OrderListNameTakenException());

        var result = await harness.Update.HandleAsync(OrderListKind.ProductType, harness.Id, Valid() with { Name = "Office" }, TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull()["name"].ShouldBe(["That name is already used. Choose another one."]);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task AnEntryThatVanishesBeforeTheEditsFinalReadIsA404()
    {
        var harness = new Harness(OrderListKind.ProductType, detailMissing: true);

        var result = await harness.Update.HandleAsync(OrderListKind.ProductType, harness.Id, Valid() with { Tone = "neutral" }, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("product-types.not-found");
    }

    [Fact]
    public async Task RetiringAnUnknownEntryIsA404AndNothingIsWritten()
    {
        var harness = new Harness(OrderListKind.PaymentMethod, found: false);

        var result = await harness.Retire.HandleAsync(OrderListKind.PaymentMethod, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("payment-methods.not-found");
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task RetiringAnActiveEntryMarksItAtTheClockAuditsAndSavesOnce()
    {
        var harness = new Harness(OrderListKind.PaymentMethod);

        var result = await harness.Retire.HandleAsync(OrderListKind.PaymentMethod, harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Entry.RetiredAtUtc.ShouldBe(Later);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(
            AuditActions.PaymentMethodRetired, "PaymentMethod", harness.Id.ToString("D"), "name=Supplies", Independent: false));
    }

    [Fact]
    public async Task RetiringARetiredEntryIsSuccessThatWritesAndAuditsNothing()
    {
        var harness = new Harness(OrderListKind.ProductType, retired: true);

        var result = await harness.Retire.HandleAsync(OrderListKind.ProductType, harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task RetiringOthersIsRefusedAsProtected()
    {
        var harness = new Harness(OrderListKind.OrderExpenseCategory, others: true);

        var result = await harness.Retire.HandleAsync(OrderListKind.OrderExpenseCategory, harness.Id, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("order-expense-categories.protected");
        harness.Entry.IsRetired.ShouldBeFalse();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ARetireThatLosesARaceReadsAgainAndRetiresTheFreshRow()
    {
        var harness = new Harness(OrderListKind.ProductType, freshRowEachRead: true);
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Retire.HandleAsync(OrderListKind.ProductType, harness.Id, TestContext.Current.CancellationToken);

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
        var harness = new Harness(OrderListKind.ProductType, freshRowEachRead: true);
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Retire.HandleAsync(OrderListKind.ProductType, harness.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Unit.Saves.ShouldBe(2);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task ReactivatingAnUnknownEntryIsA404()
    {
        var harness = new Harness(OrderListKind.ProductType, found: false);

        var result = await harness.Reactivate.HandleAsync(OrderListKind.ProductType, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("product-types.not-found");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ReactivatingARetiredEntryBringsItBackAuditsAndSavesOnce()
    {
        var harness = new Harness(OrderListKind.OrderExpenseCategory, retired: true);

        var result = await harness.Reactivate.HandleAsync(OrderListKind.OrderExpenseCategory, harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Entry.IsRetired.ShouldBeFalse();
        harness.Unit.Saves.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(
            AuditActions.OrderExpenseCategoryReactivated, "OrderExpenseCategory", harness.Id.ToString("D"), "name=Supplies", Independent: false));
    }

    [Fact]
    public async Task ReactivatingAnActiveEntryIsSuccessThatWritesAndAuditsNothing()
    {
        var harness = new Harness(OrderListKind.ProductType);

        var result = await harness.Reactivate.HandleAsync(OrderListKind.ProductType, harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AReactivateThatLosesARaceReadsAgainAndTwoLostRacesAnswerBusy()
    {
        var once = new Harness(OrderListKind.ProductType, retired: true, freshRowEachRead: true);
        once.Unit.FailFirstSaveWithConflict();
        var twice = new Harness(OrderListKind.ProductType, retired: true, freshRowEachRead: true);
        twice.Unit.FailEverySaveWithConflict();

        var recovered = await once.Reactivate.HandleAsync(OrderListKind.ProductType, once.Id, TestContext.Current.CancellationToken);
        var busy = await twice.Reactivate.HandleAsync(OrderListKind.ProductType, twice.Id, TestContext.Current.CancellationToken);

        recovered.IsSuccess.ShouldBeTrue();
        once.Unit.Saves.ShouldBe(2);
        busy.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task DeletingAnUnknownEntryIsA404()
    {
        var harness = new Harness(OrderListKind.ProductType, found: false);

        var result = await harness.Delete.HandleAsync(OrderListKind.ProductType, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("product-types.not-found");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task DeletingOthersIsRefusedAsProtectedWithoutCountingUses()
    {
        var harness = new Harness(OrderListKind.OrderExpenseCategory, others: true);

        var result = await harness.Delete.HandleAsync(OrderListKind.OrderExpenseCategory, harness.Id, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("order-expense-categories.protected");
        await harness.Lists.DidNotReceiveWithAnyArgs().CountUsesAsync(default, default, TestContext.Current.CancellationToken);
        harness.Lists.DidNotReceiveWithAnyArgs().Remove(default!);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Theory]
    [InlineData(OrderListKind.ProductType, "product-types.in-use", "This product type is used by an order, so it can't be deleted. Retire it instead.")]
    [InlineData(OrderListKind.PaymentMethod, "payment-methods.in-use", "This payment method is used by an order, so it can't be deleted. Retire it instead.")]
    [InlineData(OrderListKind.OrderExpenseCategory, "order-expense-categories.in-use", "This category is used by an order, so it can't be deleted. Retire it instead.")]
    public async Task AnEntryARowUsesCannotBeDeleted(OrderListKind kind, string code, string message)
    {
        var harness = new Harness(kind, uses: 1);

        var result = await harness.Delete.HandleAsync(kind, harness.Id, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe(code);
        result.Error.Message.ShouldBe(message);
        harness.Lists.DidNotReceiveWithAnyArgs().Remove(default!);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnusedEntryIsAuditedRemovedAndSavedInOneTransaction()
    {
        var harness = new Harness(OrderListKind.PaymentMethod);

        var result = await harness.Delete.HandleAsync(OrderListKind.PaymentMethod, harness.Id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Lists.Received(1).Remove(harness.Entry);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(
            AuditActions.PaymentMethodDeleted, "PaymentMethod", harness.Id.ToString("D"), "name=Supplies", Independent: false));
    }

    [Fact]
    public async Task ARowAddedBeforeTheSaveMakesTheForeignKeyBackstopAnInUseAnswer()
    {
        var harness = new Harness(OrderListKind.ProductType);
        harness.Unit.ThrowOnSave(new OrderListEntryInUseException());

        var result = await harness.Delete.HandleAsync(OrderListKind.ProductType, harness.Id, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("product-types.in-use");
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task ADeleteThatLosesARaceReadsAgainAndDeletesAndTwoLostRacesAnswerBusy()
    {
        var once = new Harness(OrderListKind.ProductType, freshRowEachRead: true);
        once.Unit.FailFirstSaveWithConflict();
        var twice = new Harness(OrderListKind.ProductType, freshRowEachRead: true);
        twice.Unit.FailEverySaveWithConflict();

        var recovered = await once.Delete.HandleAsync(OrderListKind.ProductType, once.Id, TestContext.Current.CancellationToken);
        var busy = await twice.Delete.HandleAsync(OrderListKind.ProductType, twice.Id, TestContext.Current.CancellationToken);

        recovered.IsSuccess.ShouldBeTrue();
        once.Unit.Saves.ShouldBe(2);
        once.Unit.Commits.ShouldBe(1);
        busy.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task ADeleteWhoseEntryVanishesOnTheSecondPassIsA404()
    {
        var harness = new Harness(OrderListKind.ProductType);
        harness.Unit.FailFirstSaveWithConflict();
        harness.Lists.FindAsync(Arg.Any<OrderListKind>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<OrderListEntry?>(harness.Entry), Task.FromResult<OrderListEntry?>(null));

        var result = await harness.Delete.HandleAsync(OrderListKind.ProductType, harness.Id, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("product-types.not-found");
    }

    [Fact]
    public void ADescriptorOfAnUnknownListRefusesInsteadOfActingAsTheOrderExpenseCategories()
    {
        var unknown = new OrderListDescriptor((OrderListKind)9, "unknown", "Unknown", "thing");

        Should.Throw<ArgumentOutOfRangeException>(() => unknown.AddedAction);
        Should.Throw<ArgumentOutOfRangeException>(() => unknown.RenamedAction);
        Should.Throw<ArgumentOutOfRangeException>(() => unknown.RecoloredAction);
        Should.Throw<ArgumentOutOfRangeException>(() => unknown.RetiredAction);
        Should.Throw<ArgumentOutOfRangeException>(() => unknown.ReactivatedAction);
        Should.Throw<ArgumentOutOfRangeException>(() => unknown.DeletedAction);
        Should.Throw<ArgumentOutOfRangeException>(() => unknown.CreateEntry("Sample", "info", Now));
    }

    [Fact]
    public async Task TheAuditActionsOfEachListFollowItsNameAndTargetType()
    {
        foreach (var (kind, prefix, target) in new[]
        {
            (OrderListKind.ProductType, "product-type", "ProductType"),
            (OrderListKind.PaymentMethod, "payment-method", "PaymentMethod"),
            (OrderListKind.OrderExpenseCategory, "order-expense-category", "OrderExpenseCategory"),
        })
        {
            var descriptor = OrderListDescriptor.For(kind);
            descriptor.AuditTargetType.ShouldBe(target);
            descriptor.AddedAction.ShouldBe($"{prefix}.added");
            descriptor.RenamedAction.ShouldBe($"{prefix}.renamed");
            descriptor.RecoloredAction.ShouldBe($"{prefix}.recolored");
            descriptor.RetiredAction.ShouldBe($"{prefix}.retired");
            descriptor.ReactivatedAction.ShouldBe($"{prefix}.reactivated");
            descriptor.DeletedAction.ShouldBe($"{prefix}.deleted");
            var created = descriptor.CreateEntry("Sample", "info", Now);
            created.IsSuccess.ShouldBeTrue();
            created.Value.GetType().Name.ShouldBe(target);
            descriptor.CreateEntry(" ", "info", Now).IsFailure.ShouldBeTrue();
        }

        await Task.CompletedTask;
    }

    [Fact]
    public async Task TheValidatorNeedsAVersionOnlyForAnEditAndFallsBackToEntryWithoutAList()
    {
        var validator = new OrderListEntryRequestValidator();
        var request = new OrderListEntryRequest("", "info", null);

        var asAdd = await validator.ValidateAsync(new ValidationContext<OrderListEntryRequest>(request), TestContext.Current.CancellationToken);
        var context = new ValidationContext<OrderListEntryRequest>(request);
        context.RootContextData[OrderListEntryRequestValidator.EditKey] = true;
        var asEdit = await validator.ValidateAsync(context, TestContext.Current.CancellationToken);
        var forty = await validator.ValidateAsync(new OrderListEntryRequest(new string('x', 40), "info", null), TestContext.Current.CancellationToken);
        var fortyOne = await validator.ValidateAsync(new OrderListEntryRequest(new string('x', 41), "info", null), TestContext.Current.CancellationToken);

        asAdd.Errors.Select(failure => failure.ErrorMessage).ShouldBe(["Enter a name."]);
        asEdit.Errors.Select(failure => failure.ErrorMessage).ShouldBe(["Enter a name.", "Reload the form and try again."]);
        forty.IsValid.ShouldBeTrue();
        fortyOne.Errors.ShouldHaveSingleItem().ErrorMessage.ShouldBe("Keep the name to 40 characters or fewer.");
    }

    private static OrderListEntryRequest Valid() => new("Supplies", "warning", StoredVersionText);

    private sealed class Harness
    {
        private readonly OrderListKind _kind;
        private readonly bool _others;
        private readonly bool _retired;

        public Harness(
            OrderListKind kind,
            bool found = true,
            bool retired = false,
            bool others = false,
            bool nameTaken = false,
            bool detailMissing = false,
            bool detailRetired = false,
            bool freshRowEachRead = false,
            int uses = 0)
        {
            _kind = kind;
            _others = others;
            _retired = retired;
            Entry = Build();
            Lists = Substitute.For<IOrderLists>();
            Lists.FindAsync(Arg.Any<OrderListKind>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(_ =>
            {
                if (!found)
                {
                    return Task.FromResult<OrderListEntry?>(null);
                }

                var served = Served.Count == 0 || !freshRowEachRead ? Entry : Build();
                Served.Add(served);
                return Task.FromResult<OrderListEntry?>(served);
            });
            Lists.NameTakenAsync(Arg.Any<OrderListKind>(), Arg.Any<string>(), Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(nameTaken);
            Lists.CountUsesAsync(Arg.Any<OrderListKind>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(uses);
            Lists.GetDetailAsync(Arg.Any<OrderListKind>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult<OrderListEntryDetailView?>(detailMissing ? null : Detail(call.ArgAt<Guid>(1), detailRetired)));
            Lists.When(lists => lists.Add(Arg.Any<OrderListEntry>())).Do(call => Added.Add(call.Arg<OrderListEntry>()));

            var time = new FakeTimeProvider(Later);
            var validator = new OrderListEntryRequestValidator();
            Create = new CreateOrderListEntryHandler(Lists, Audit, Unit, time, validator);
            Get = new GetOrderListEntryHandler(Lists);
            Update = new UpdateOrderListEntryHandler(Lists, Audit, Unit, validator);
            Retire = new RetireOrderListEntryHandler(Lists, Audit, Unit, time);
            Reactivate = new ReactivateOrderListEntryHandler(Lists, Audit, Unit);
            Delete = new DeleteOrderListEntryHandler(Lists, Audit, Unit);
        }

        public OrderListEntry Entry { get; }

        public Guid Id => Entry.Id;

        public List<OrderListEntry> Served { get; } = [];

        public List<OrderListEntry> Added { get; } = [];

        public IOrderLists Lists { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public CreateOrderListEntryHandler Create { get; }

        public GetOrderListEntryHandler Get { get; }

        public UpdateOrderListEntryHandler Update { get; }

        public RetireOrderListEntryHandler Retire { get; }

        public ReactivateOrderListEntryHandler Reactivate { get; }

        public DeleteOrderListEntryHandler Delete { get; }

        private static OrderListEntryDetailView Detail(Guid id, bool retired) => new(
            id,
            "Entry detail",
            "success",
            Retired: retired,
            IsOthers: false,
            UseCount: 2,
            RecordedBy: null,
            CreatedAtUtc: Now,
            LastChangedBy: new ActorRef(Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43"), "Paolo Reyes", false),
            UpdatedAtUtc: Now.AddHours(1),
            RowVersion: [0, 0, 0, 0, 0, 0, 0x1F, 0xA5]);

        private OrderListEntry Build()
        {
            OrderListEntry entry = _others
                ? OrderExpenseCategory.FromSeed(OrderListSeed.OrderExpenseCategories.Single(row => row.Id == OrderListSeed.OrderExpenseOthersId))
                : _kind switch
                {
                    OrderListKind.ProductType => ProductType.Create("Supplies", "warning", Now).Value,
                    OrderListKind.PaymentMethod => PaymentMethod.Create("Supplies", "warning", Now).Value,
                    _ => OrderExpenseCategory.Create("Supplies", "warning", Now).Value,
                };
            typeof(OrderListEntry).GetProperty(nameof(OrderListEntry.RowVersion), BindingFlags.Public | BindingFlags.Instance)!.SetValue(entry, StoredVersion);
            if (_retired)
            {
                entry.Retire(Now);
            }

            return entry;
        }
    }
}

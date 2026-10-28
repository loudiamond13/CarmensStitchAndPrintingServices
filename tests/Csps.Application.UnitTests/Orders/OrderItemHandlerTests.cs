using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-05, ORD-08, D-18, D-19: the item handlers check the form, find the order, compare the version and save once; a remove is read again once after a lost race.</summary>
public sealed class OrderItemHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid PoloType = Guid.Parse("01a17fce-7801-7e45-b875-357767854eda");
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 31, 164];
    private static readonly string StoredVersionText = Convert.ToBase64String(StoredVersion);
    private static readonly string OtherVersionText = Convert.ToBase64String([0, 0, 0, 0, 0, 0, 31, 165]);

    [Fact]
    public async Task AddWithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AddAnEmptyFormListsEveryRequiredFieldIncludingTheVersion()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, AddOrderItemRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["description", "productTypeId", "quantity", "unitPrice", "version"]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddARetiredProductTypeIsA400OnProductTypeIdAndTheOrderIsNotLookedUp()
    {
        var harness = new Harness();
        harness.SetProductType(PoloType, retired: true);

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd(), TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["productTypeId"]);
        Fields(result)["productTypeId"].ShouldBe(["This product type was retired. Choose another one."]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddAnUnknownProductTypeIsA400WithTheChooseMessage()
    {
        var harness = new Harness();
        harness.Lists.GetStatesAsync(OrderListKind.ProductType, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<OrderListEntryState>>([]));

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { ProductTypeId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        Fields(result)["productTypeId"].ShouldBe(["Choose a product type."]);
    }

    [Fact]
    public async Task AddAStaticErrorAndAProductTypeErrorComeBackTogether()
    {
        var harness = new Harness();
        harness.SetProductType(PoloType, retired: true);

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Quantity = 0 }, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["productTypeId", "quantity"]);
    }

    [Fact]
    public async Task AddAMissingProductTypeIsNotLookedUp()
    {
        var harness = new Harness();

        await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { ProductTypeId = null }, TestContext.Current.CancellationToken);
        await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { ProductTypeId = Guid.Empty }, TestContext.Current.CancellationToken);

        await harness.Lists.DidNotReceiveWithAnyArgs().GetStatesAsync(default, default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task AddSavesOnceInOneTransactionAndReadsTheOrderBack()
    {
        var harness = new Harness();
        harness.SetProductType(PoloType, retired: false);

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Items.Count.ShouldBe(3);
        harness.Last.Items[2].Description.ShouldBe("Warm-up");
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(harness.OrderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddAStaleVersionIsRefusedAndNothingIsSaved()
    {
        var harness = new Harness();
        harness.SetProductType(PoloType, retired: false);

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Version = OtherVersionText }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Last.Items.Count.ShouldBe(2);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddALostRaceAtSaveTimeIsStaleAndIsNotRetried()
    {
        var harness = new Harness();
        harness.SetProductType(PoloType, retired: false);
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
        await harness.Orders.Received(1).FindAsync(harness.OrderId, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddToAnUnknownOrderIsA404()
    {
        var harness = new Harness(found: false);
        harness.SetProductType(PoloType, retired: false);

        var result = await harness.Add.HandleAsync(Guid.NewGuid(), ValidAdd(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
        await harness.Reader.DidNotReceiveWithAnyArgs().GetDetailAsync(default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task AddToAFullOrderIsA422AndNothingIsSaved()
    {
        var harness = new Harness(itemCount: 100);
        harness.SetProductType(PoloType, retired: false);

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.TooManyItems);
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddAnOrderTheReaderCannotFindAfterTheSaveIsA404()
    {
        var harness = new Harness();
        harness.SetProductType(PoloType, retired: false);
        harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(null));

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    [Fact]
    public async Task AddANullRequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Add.HandleAsync(harness.OrderId, null!, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task UpdateWithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstItemId, ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateAnEmptyFormListsEveryRequiredFieldIncludingTheVersion()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstItemId, UpdateOrderItemRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["description", "productTypeId", "quantity", "unitPrice", "version"]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateAnEditThatKeepsASavedRetiredProductTypeIsAllowedAndTheListIsNotAsked()
    {
        var harness = new Harness();
        harness.SetProductType(JerseyType, retired: true);

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstItemId, ValidUpdate() with { ProductTypeId = JerseyType, Quantity = 30 }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Items[0].Quantity.ShouldBe(30);
        harness.Unit.Saves.ShouldBe(1);
        await harness.Lists.DidNotReceiveWithAnyArgs().GetStatesAsync(default, default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task UpdateAnEditThatSwitchesToARetiredProductTypeIsA400AndNothingIsSaved()
    {
        var harness = new Harness();
        harness.SetProductType(PoloType, retired: true);

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstItemId, ValidUpdate() with { ProductTypeId = PoloType }, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["productTypeId"]);
        Fields(result)["productTypeId"].ShouldBe(["This product type was retired. Choose another one."]);
        result.Error.Code.ShouldBe("orders.invalid-request");
        harness.Last.Items[0].ProductTypeId.ShouldBe(JerseyType);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateAnEditThatSwitchesToAnActiveProductTypeIsSaved()
    {
        var harness = new Harness();
        harness.SetProductType(PoloType, retired: false);

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstItemId, ValidUpdate() with { ProductTypeId = PoloType }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Items[0].ProductTypeId.ShouldBe(PoloType);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task UpdateAStaleVersionIsRefusedAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstItemId, ValidUpdate() with { Version = OtherVersionText }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Last.Items[0].Quantity.ShouldBe(15);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateALostRaceAtSaveTimeIsStaleAndIsNotRetried()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstItemId, ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
        await harness.Orders.Received(1).FindAsync(harness.OrderId, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateAnItemThatIsNotOnTheOrderIsA404AndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, Guid.NewGuid(), ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.ItemNotFound);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateAnUnknownOrderIsA404()
    {
        var harness = new Harness(found: false);

        var result = await harness.Update.HandleAsync(Guid.NewGuid(), Guid.NewGuid(), ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    [Fact]
    public async Task UpdateAFormWithNoChangeIsA200ThatSavesNothing()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstItemId, ValidUpdate() with { Quantity = 15 }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(harness.OrderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateANullRequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Update.HandleAsync(harness.OrderId, harness.FirstItemId, null!, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task RemoveWithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstItemId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task RemoveTakesTheItemOutSavesOnceAndReadsTheOrderBack()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstItemId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Items.Count.ShouldBe(1);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(harness.OrderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemoveTheLastItemIsA422AndNothingIsSaved()
    {
        var harness = new Harness(itemCount: 1);

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstItemId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.LastItem);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task RemoveAnItemThatIsNotOnTheOrderIsA404()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.ItemNotFound);
    }

    [Fact]
    public async Task RemoveFromAnUnknownOrderIsA404()
    {
        var harness = new Harness(found: false);

        var result = await harness.Remove.HandleAsync(Guid.NewGuid(), Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    [Fact]
    public async Task RemoveThatLosesOneRaceReadsTheOrderAgainAndDecidesAgain()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstItemId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        await harness.Orders.Received(2).FindAsync(harness.OrderId, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemoveThatLosesTwoRacesAnswersTheStaleConflict()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstItemId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(2);
    }

    [Fact]
    public async Task RemoveAnOrderTheReaderCannotFindAfterTheSaveIsA404()
    {
        var harness = new Harness();
        harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(null));

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstItemId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    [Fact]
    public async Task AddRecordsOneAddedEntryForTheOrderBeforeTheSaveWithNoItemText()
    {
        var harness = new Harness();
        harness.SetProductType(PoloType, retired: false);

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Description = "Private words", SizeVariant = "Private size" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        var added = harness.Last.Items[2];
        entry.Call.ShouldBe(new AuditCall(AuditActions.OrderItemAdded, "Order", harness.OrderId.ToString("D"), $"item={added.Id:D};productType={PoloType:D};quantity=3;unitPrice=400.00", Independent: false));
        entry.SavesSoFar.ShouldBe(0);
        entry.Call.Detail.ShouldNotBeNull().ShouldNotContain("Private", Case.Insensitive);
    }

    [Fact]
    public async Task UpdateRecordsOneChangedEntryWithOldAndNewPairsAndTheFieldNames()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstItemId, ValidUpdate() with { Description = "Private words", Quantity = 20 }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.Action.ShouldBe(AuditActions.OrderItemChanged);
        entry.Call.TargetType.ShouldBe("Order");
        entry.Call.TargetId.ShouldBe(harness.OrderId.ToString("D"));
        entry.Call.Detail.ShouldBe($"item={harness.FirstItemId:D};productType={JerseyType:D};quantity=15>20;unitPrice=650.00;fields=description");
        entry.SavesSoFar.ShouldBe(0);
    }

    [Fact]
    public async Task RemoveRecordsOneRemovedEntryForTheOrderBeforeTheSave()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstItemId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(AuditActions.OrderItemRemoved, "Order", harness.OrderId.ToString("D"), $"item={harness.FirstItemId:D};productType={JerseyType:D};quantity=15;unitPrice=650.00", Independent: false));
        entry.SavesSoFar.ShouldBe(0);
    }

    [Fact]
    public async Task ARemoveThatLosesOneRaceRecordsAnEntryForEachAttemptAndEachJoinsItsOwnSave()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        await harness.Remove.HandleAsync(harness.OrderId, harness.FirstItemId, TestContext.Current.CancellationToken);

        harness.Audit.Entries.Select(static entry => entry.SavesSoFar).ShouldBe([0, 1]);
    }

    [Fact]
    public async Task NothingIsRecordedForANoOpEditAStaleVersionAMissingItemOrAnOrderRule()
    {
        var noOp = new Harness();
        await noOp.Update.HandleAsync(noOp.OrderId, noOp.FirstItemId, ValidUpdate() with { Quantity = 15 }, TestContext.Current.CancellationToken);
        var stale = new Harness();
        await stale.Update.HandleAsync(stale.OrderId, stale.FirstItemId, ValidUpdate() with { Version = OtherVersionText }, TestContext.Current.CancellationToken);
        var missing = new Harness();
        await missing.Remove.HandleAsync(missing.OrderId, Guid.NewGuid(), TestContext.Current.CancellationToken);
        var last = new Harness(itemCount: 1);
        await last.Remove.HandleAsync(last.OrderId, last.FirstItemId, TestContext.Current.CancellationToken);
        var full = new Harness(itemCount: 100);
        full.SetProductType(PoloType, retired: false);
        await full.Add.HandleAsync(full.OrderId, ValidAdd(), TestContext.Current.CancellationToken);
        var retired = new Harness();
        retired.SetProductType(PoloType, retired: true);
        await retired.Update.HandleAsync(retired.OrderId, retired.FirstItemId, ValidUpdate() with { ProductTypeId = PoloType }, TestContext.Current.CancellationToken);

        noOp.Audit.Entries.ShouldBeEmpty();
        stale.Audit.Entries.ShouldBeEmpty();
        missing.Audit.Entries.ShouldBeEmpty();
        last.Audit.Entries.ShouldBeEmpty();
        full.Audit.Entries.ShouldBeEmpty();
        retired.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task EveryChangeLocksTheOrderOnceBeforeTheSaveAndANoOpNeverLocks()
    {
        var added = new Harness();
        added.SetProductType(PoloType, retired: false);
        var edited = new Harness();
        var removed = new Harness();
        var noOp = new Harness();

        await added.Add.HandleAsync(added.OrderId, ValidAdd(), TestContext.Current.CancellationToken);
        await edited.Update.HandleAsync(edited.OrderId, edited.FirstItemId, ValidUpdate(), TestContext.Current.CancellationToken);
        await removed.Remove.HandleAsync(removed.OrderId, removed.FirstItemId, TestContext.Current.CancellationToken);
        await noOp.Update.HandleAsync(noOp.OrderId, noOp.FirstItemId, ValidUpdate() with { Quantity = 15 }, TestContext.Current.CancellationToken);

        added.LockedAtSave.ShouldBe([0]);
        edited.LockedAtSave.ShouldBe([0]);
        removed.LockedAtSave.ShouldBe([0]);
        noOp.LockedAtSave.ShouldBeEmpty();
        await added.Orders.Received(1).LockAsync(added.Last, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AFormSaveThatLosesTheLockIsStaleSavesNothingAndIsNotRetried()
    {
        var add = new Harness();
        add.SetProductType(PoloType, retired: false);
        add.FailLocks(1);
        var edit = new Harness();
        edit.FailLocks(1);

        var added = await add.Add.HandleAsync(add.OrderId, ValidAdd(), TestContext.Current.CancellationToken);
        var edited = await edit.Update.HandleAsync(edit.OrderId, edit.FirstItemId, ValidUpdate(), TestContext.Current.CancellationToken);

        added.Error.ShouldBe(EditErrors.Stale);
        edited.Error.ShouldBe(EditErrors.Stale);
        add.Unit.Saves.ShouldBe(0);
        edit.Unit.Saves.ShouldBe(0);
        add.LockedAtSave.Count.ShouldBe(1);
        add.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ARemoveThatLosesTheLockReadsTheOrderAgainAndDecidesAgain()
    {
        var once = new Harness();
        once.FailLocks(1);
        var twice = new Harness();
        twice.FailLocks(2);

        var recovered = await once.Remove.HandleAsync(once.OrderId, once.FirstItemId, TestContext.Current.CancellationToken);
        var gaveUp = await twice.Remove.HandleAsync(twice.OrderId, twice.FirstItemId, TestContext.Current.CancellationToken);

        recovered.IsSuccess.ShouldBeTrue();
        once.LockedAtSave.ShouldBe([0, 0]);
        once.Unit.Saves.ShouldBe(1);
        gaveUp.Error.ShouldBe(EditErrors.Stale);
        twice.Unit.Saves.ShouldBe(0);
        twice.LockedAtSave.Count.ShouldBe(2);
    }

    private static AddOrderItemRequest ValidAdd() => new(PoloType, "Warm-up", "XL", 3, 400.00m, StoredVersionText);

    private static UpdateOrderItemRequest ValidUpdate() => new(JerseyType, "Jersey top", "S-XL", 16, 650.00m, StoredVersionText);

    private static IReadOnlyDictionary<string, string[]> Fields(Result<OrderDetailResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        return result.Error.FieldErrors.ShouldNotBeNull();
    }

    private sealed class Harness
    {
        private readonly List<Order> _loaded = [];
        private int _lockFailures;

        public Harness(bool noCaller = false, bool found = true, int itemCount = 2)
        {
            Audit = new SaveAwareAudit(Unit);
            var seed = Make(itemCount);
            OrderId = seed.Id;
            FirstItemId = seed.Items[0].Id;
            Orders = Substitute.For<IOrders>();
            Orders.FindAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
                .Returns(_ => Task.FromResult<Order?>(found ? Load(seed) : null));
            Orders.LockAsync(Arg.Any<Order>(), Arg.Any<CancellationToken>()).Returns(_ =>
            {
                LockedAtSave.Add(Unit.Saves);
                if (_lockFailures > 0)
                {
                    _lockFailures--;
                    throw new ConcurrencyConflictException(new InvalidOperationException("The order was changed after it was loaded."));
                }

                return Task.CompletedTask;
            });
            Reader = Substitute.For<IOrderReader>();
            Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(Detail()));
            Lists = Substitute.For<IOrderLists>();
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            var calendar = new FixedCalendar();
            Add = new AddOrderItemHandler(Orders, Reader, Lists, calendar, Audit, Unit, request, new AddOrderItemRequestValidator());
            Update = new UpdateOrderItemHandler(Orders, Reader, Lists, calendar, Audit, Unit, request, new UpdateOrderItemRequestValidator());
            Remove = new RemoveOrderItemHandler(Orders, Reader, calendar, Audit, Unit, request);
        }

        public Guid OrderId { get; }

        public Guid FirstItemId { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public IOrderLists Lists { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public SaveAwareAudit Audit { get; }

        /// <summary>Gets how many saves had happened each time the order was locked.</summary>
        public List<int> LockedAtSave { get; } = [];

        public AddOrderItemHandler Add { get; }

        public UpdateOrderItemHandler Update { get; }

        public RemoveOrderItemHandler Remove { get; }

        /// <summary>Gets the order instance the handlers worked on last.</summary>
        public Order Last => _loaded[^1];

        public void FailLocks(int count) => _lockFailures = count;

        public void SetProductType(Guid id, bool retired) =>
            Lists.GetStatesAsync(OrderListKind.ProductType, Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Contains(id)), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IReadOnlyList<OrderListEntryState>>([new OrderListEntryState(id, "Type", retired)]));

        // Every load gives a fresh copy with the same ids, as a new read from the store would after a rolled back attempt.
        private Order Load(Order seed)
        {
            var copy = Make(seed.Items.Count, seed.Id, [.. seed.Items.Select(static item => item.Id)]);
            _loaded.Add(copy);
            return copy;
        }

        private static Order Make(int itemCount, Guid? id = null, IReadOnlyList<Guid>? itemIds = null)
        {
            var items = new List<NewOrderItem>
            {
                new(JerseyType, "Jersey top", "S-XL", 15, 650.00m),
                new(PoloType, "Coach polo", "L", 2, 550.00m),
            };
            while (items.Count < itemCount)
            {
                items.Add(new NewOrderItem(JerseyType, $"Extra {items.Count}", null, 1, 10.00m));
            }

            var details = new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
            var order = Order.Create(new NewOrder(details, OrderStatus.Pending, [.. items.Take(itemCount)]), Guid.NewGuid(), Now).Value;
            typeof(Order).GetProperty(nameof(Order.RowVersion), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, StoredVersion);
            if (id is { } fixedId)
            {
                typeof(Order).GetProperty(nameof(Order.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, fixedId);
                for (var index = 0; index < order.Items.Count; index++)
                {
                    typeof(OrderItem).GetProperty(nameof(OrderItem.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order.Items[index], itemIds![index]);
                }
            }

            return order;
        }

        private static OrderDetailResponse Detail() => new(
            Guid.NewGuid(),
            "ORD-2026-0001",
            "Juan Dela Cruz",
            null,
            "0917 123 4567",
            null,
            null,
            new DateOnly(2026, 10, 28),
            new DateOnly(2026, 11, 11),
            "pending",
            Now,
            null,
            [],
            [],
            new OrderTotalsResponse(0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, false),
            new ActorRef(CallerId, "Mina Mercado", false),
            Now,
            null,
            null,
            "AAAAAAAAH6Q=");
    }

    // Remembers how many saves had happened when each entry was recorded, so a test can prove the entry joins the change's save.
    private sealed class SaveAwareAudit(FakeUnitOfWork unit) : IAuditTrail
    {
        public List<(AuditCall Call, int SavesSoFar)> Entries { get; } = [];

        public void Record(string action, string? targetType, string? targetId, string? detail) =>
            Entries.Add((new AuditCall(action, targetType, targetId, detail, Independent: false), unit.Saves));

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken) =>
            throw new NotSupportedException("The item audit entry must join the change's own save.");
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}

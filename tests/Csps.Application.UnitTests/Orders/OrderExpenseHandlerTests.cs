using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-05, ORD-08, ORD-23, D-17, D-30, D-31: the expense handlers check the form, the category and the payer, find the order, compare the version and save once.</summary>
public sealed class OrderExpenseHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Fabric = Guid.Parse("01a17fce-780b-75d1-89e0-5b3b9b185a2c");
    private static readonly Guid Ink = Guid.Parse("01a17fce-780c-73e0-b847-33f866e42d3d");
    private static readonly Guid Retired = Guid.Parse("5b3e8a14-6c27-4d90-a1f5-0e9c7d2b4a68");
    private static readonly Guid SavedPayer = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");
    private static readonly Guid NewPayer = Guid.Parse("a41d7c92-0b58-4e3f-96d1-8c2e5f7a3b04");
    private static readonly Guid Blocked = Guid.Parse("d6e90b13-72a4-4f58-8c1d-3a5b7e9f0c26");
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

        var result = await harness.Add.HandleAsync(harness.OrderId, AddOrderExpenseRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "expenseDate", "orderExpenseCategoryId", "paidByUserId", "version"]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddADateThatIsNotARealDayOrIsMoreThanThirtyDaysAheadIsA400OnTheDate()
    {
        var harness = new Harness();

        var notReal = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { ExpenseDate = "2026-02-30" }, TestContext.Current.CancellationToken);
        var tooFar = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { ExpenseDate = "2026-11-28" }, TestContext.Current.CancellationToken);
        var latest = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { ExpenseDate = "2026-11-27" }, TestContext.Current.CancellationToken);
        var longAgo = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { ExpenseDate = "2024-01-05" }, TestContext.Current.CancellationToken);

        Fields(notReal)["expenseDate"].ShouldBe(["Enter a real date."]);
        Fields(tooFar)["expenseDate"].ShouldBe(["Choose a date up to 30 days from today, Nov 27, 2026 at the latest."]);
        latest.IsSuccess.ShouldBeTrue();
        longAgo.IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData(0, "Enter an amount greater than ₱0.00.")]
    [InlineData(-5, "Enter an amount greater than ₱0.00.")]
    [InlineData(1_000_000.01, "Enter an amount of ₱1,000,000.00 or less.")]
    [InlineData(10.005, "Use at most 2 decimal places.")]
    public async Task AddAnAmountOutOfRangeOrWithTooManyDecimalsIsA400OnAmount(double amount, string message)
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Amount = (decimal)amount }, TestContext.Current.CancellationToken);

        Fields(result)["amount"].ShouldBe([message]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AddADescriptionOverTwoHundredCharactersIsRefusedAndNoDescriptionIsAccepted()
    {
        var harness = new Harness();

        var tooLong = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Description = new string('d', 201) }, TestContext.Current.CancellationToken);
        var none = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Description = null }, TestContext.Current.CancellationToken);

        Fields(tooLong)["description"].ShouldBe(["Keep the description to 200 characters or fewer."]);
        none.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public async Task AddARetiredCategoryIsA400OnTheCategoryAndNothingIsLoaded()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { OrderExpenseCategoryId = Retired }, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["orderExpenseCategoryId"]);
        Fields(result)["orderExpenseCategoryId"].ShouldBe(["This category was retired. Choose another one."]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AddAnUnknownCategoryIsA400WithTheChooseMessage()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { OrderExpenseCategoryId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        Fields(result)["orderExpenseCategoryId"].ShouldBe(["Choose a category."]);
    }

    [Fact]
    public async Task AddAPayerWhoCannotBeChosenIsA400OnThePayer()
    {
        var harness = new Harness();

        var blocked = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { PaidByUserId = Blocked }, TestContext.Current.CancellationToken);
        var unknown = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { PaidByUserId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        Fields(blocked).Keys.ShouldBe(["paidByUserId"]);
        Fields(blocked)["paidByUserId"].ShouldBe(["This person can't be chosen because their account isn't active. Choose someone else."]);
        Fields(unknown)["paidByUserId"].ShouldBe(["This person can't be chosen because their account isn't active. Choose someone else."]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AddACategoryAndAPayerThatFailAreListedInTheSame400()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { OrderExpenseCategoryId = Retired, PaidByUserId = Blocked }, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["orderExpenseCategoryId", "paidByUserId"]);
    }

    [Fact]
    public async Task AddSavesTheExpenseOnceAndReadsTheOrderBack()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Expenses.Count.ShouldBe(2);
        harness.Last.ExpensesTotal.ShouldBe(4325m);
        harness.Last.Balance.ShouldBe(10850m);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(harness.OrderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddAStaleVersionIsRefusedAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Version = OtherVersionText }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddALostRaceAtSaveTimeIsStaleAndIsNotRetried()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
        await harness.Orders.Received(1).FindAsync(harness.OrderId, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddAnUnknownOrderIsA404()
    {
        var harness = new Harness(found: false);

        var result = await harness.Add.HandleAsync(Guid.NewGuid(), ValidAdd(), TestContext.Current.CancellationToken);

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

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateAnEmptyFormListsEveryRequiredFieldIncludingTheVersion()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, UpdateOrderExpenseRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "expenseDate", "orderExpenseCategoryId", "paidByUserId", "version"]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateKeepingASavedRetiredCategoryIsAllowedAndTheListIsNotAsked()
    {
        var harness = new Harness(savedCategory: Retired);

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, ValidUpdate() with { OrderExpenseCategoryId = Retired, Amount = 3000m }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Expenses[0].Amount.ShouldBe(3000m);
        await harness.Lists.DidNotReceiveWithAnyArgs().GetStatesAsync(default, default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task UpdateSwitchingToARetiredCategoryIsA400AndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, ValidUpdate() with { OrderExpenseCategoryId = Retired }, TestContext.Current.CancellationToken);

        Fields(result)["orderExpenseCategoryId"].ShouldBe(["This category was retired. Choose another one."]);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateKeepingASavedPayerWhoCanNoLongerBeChosenIsAllowedAndTheDirectoryIsNotAsked()
    {
        var harness = new Harness(savedPayer: Blocked);

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, ValidUpdate() with { PaidByUserId = Blocked, Amount = 3000m }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Expenses[0].PaidByUserId.ShouldBe(Blocked);
        await harness.Staff.DidNotReceiveWithAnyArgs().GetStaffStateAsync(default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task UpdateChangingThePayerToSomeoneWhoCannotBeChosenIsA400OnThePayer()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, ValidUpdate() with { PaidByUserId = Blocked }, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["paidByUserId"]);
        Fields(result)["paidByUserId"].ShouldBe(["This person can't be chosen because their account isn't active. Choose someone else."]);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateAStaleVersionIsRefusedAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, ValidUpdate() with { Version = OtherVersionText }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateAnExpenseThatIsNotOnTheOrderIsA404AndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, Guid.NewGuid(), ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.ExpenseNotFound);
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
    public async Task UpdateAFormWithNoChangeIsA200ThatSavesNothingAndRecordsNothing()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, ValidUpdate(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.LockedAtSave.ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateALostRaceAtSaveTimeIsStaleAndIsNotRetried()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, ValidUpdate() with { Amount = 3000m }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task UpdateANullRequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, null!, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AddRecordsOneAddedEntryForTheOrderBeforeTheSaveWithNoDescriptionText()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Description = "Private words" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        var added = harness.Last.Expenses[1];
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.OrderExpenseAdded,
            "Order",
            harness.OrderId.ToString("D"),
            $"expense={added.Id:D};date=2026-10-27;amount=500.00;category={Fabric:D};payer={NewPayer:D}",
            Independent: false));
        entry.SavesSoFar.ShouldBe(0);
        entry.Call.Detail.ShouldNotBeNull().ShouldNotContain("Private", Case.Insensitive);
    }

    [Fact]
    public async Task UpdateOfTheAmountAndThePayerRecordsAChangedEntryThenAPayerChangedEntryBeforeTheSave()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(
            harness.OrderId,
            harness.ExpenseId,
            ValidUpdate() with { Amount = 3000m, Description = "Private words", PaidByUserId = NewPayer },
            TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.Select(static entry => entry.Call.Action).ShouldBe([AuditActions.OrderExpenseChanged, AuditActions.OrderExpensePayerChanged]);
        harness.Audit.Entries.ShouldAllBe(entry => entry.SavesSoFar == 0 && entry.Call.TargetType == "Order" && entry.Call.TargetId == harness.OrderId.ToString("D"));
        harness.Audit.Entries[0].Call.Detail.ShouldBe(
            $"expense={harness.ExpenseId:D};date=2026-10-25;amount=3825.00>3000.00;category={Fabric:D};payer={NewPayer:D};fields=description");
        harness.Audit.Entries[1].Call.Detail.ShouldBe($"expense={harness.ExpenseId:D};payer={SavedPayer:D}>{NewPayer:D}");
        harness.Audit.Entries.ShouldAllBe(entry => !entry.Call.Detail!.Contains("Private", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task UpdateOfOnlyThePayerRecordsOnlyAPayerChangedEntry()
    {
        var harness = new Harness();

        await harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, ValidUpdate() with { PaidByUserId = NewPayer }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Call.Action.ShouldBe(AuditActions.OrderExpensePayerChanged);
    }

    [Fact]
    public async Task UpdateOfOnlyTheAmountRecordsOnlyAChangedEntry()
    {
        var harness = new Harness();

        await harness.Update.HandleAsync(harness.OrderId, harness.ExpenseId, ValidUpdate() with { Amount = 3000m }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Call.Action.ShouldBe(AuditActions.OrderExpenseChanged);
    }

    [Fact]
    public async Task RemoveWithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.ExpenseId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task RemoveTakesTheExpenseOutRecordsOneRemovedEntryAndSavesOnce()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.ExpenseId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Expenses.ShouldBeEmpty();
        harness.Last.ExpensesTotal.ShouldBe(0m);
        harness.Unit.Saves.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.OrderExpenseRemoved,
            "Order",
            harness.OrderId.ToString("D"),
            $"expense={harness.ExpenseId:D};date=2026-10-25;amount=3825.00;category={Fabric:D};payer={SavedPayer:D}",
            Independent: false));
        entry.SavesSoFar.ShouldBe(0);
        harness.LockedAtSave.ShouldBe([0]);
    }

    [Fact]
    public async Task RemoveAnExpenseThatIsNotOnTheOrderIsA404()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.ExpenseNotFound);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
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

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.ExpenseId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        await harness.Orders.Received(2).FindAsync(harness.OrderId, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemoveThatLosesTwoRacesAnswersTheStaleConflict()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.ExpenseId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(2);
    }

    [Fact]
    public async Task AFormSaveThatLosesTheLockIsStaleSavesNothingAndIsNotRetried()
    {
        var add = new Harness();
        add.FailLocks(1);
        var edit = new Harness();
        edit.FailLocks(1);

        var added = await add.Add.HandleAsync(add.OrderId, ValidAdd(), TestContext.Current.CancellationToken);
        var edited = await edit.Update.HandleAsync(edit.OrderId, edit.ExpenseId, ValidUpdate() with { Amount = 3000m }, TestContext.Current.CancellationToken);

        added.Error.ShouldBe(EditErrors.Stale);
        edited.Error.ShouldBe(EditErrors.Stale);
        add.Unit.Saves.ShouldBe(0);
        edit.Unit.Saves.ShouldBe(0);
        add.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task RemoveAnOrderTheReaderCannotFindAfterTheSaveIsA404()
    {
        var harness = new Harness();
        harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(null));

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.ExpenseId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    private static AddOrderExpenseRequest ValidAdd() =>
        new("2026-10-27", Fabric, "Dri-fit mesh", 500.00m, NewPayer, StoredVersionText);

    private static UpdateOrderExpenseRequest ValidUpdate() =>
        new("2026-10-25", Fabric, "Mesh", 3825.00m, SavedPayer, StoredVersionText);

    private static IReadOnlyDictionary<string, string[]> Fields(Result<OrderDetailResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        return result.Error.FieldErrors.ShouldNotBeNull();
    }

    private sealed class Harness
    {
        private readonly List<Order> _loaded = [];
        private readonly Guid _savedCategory;
        private readonly Guid _savedPayer;
        private int _lockFailures;

        public Harness(bool noCaller = false, bool found = true, Guid? savedCategory = null, Guid? savedPayer = null)
        {
            _savedCategory = savedCategory ?? Fabric;
            _savedPayer = savedPayer ?? SavedPayer;
            Audit = new SaveAwareAudit(Unit);
            var seed = Make(null, null);
            OrderId = seed.Id;
            ExpenseId = seed.Expenses[0].Id;
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
            Lists.GetStatesAsync(OrderListKind.OrderExpenseCategory, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                var ids = call.Arg<IReadOnlyCollection<Guid>>();
                IReadOnlyList<OrderListEntryState> states =
                [
                    .. ids.Where(static id => id == Fabric || id == Ink || id == Retired).Select(static id => new OrderListEntryState(id, "Category", id == Retired)),
                ];
                return Task.FromResult(states);
            });
            Staff = Substitute.For<IStaffDirectory>();
            Staff.GetStaffStateAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                var id = call.Arg<Guid>();
                StaffState? state = id == SavedPayer || id == NewPayer
                    ? new StaffState(id, "Mina Mercado", Roles.Manager, true, false, false, true)
                    : id == Blocked ? new StaffState(id, "Dee Dizon", Roles.Admin, false, false, false, true) : null;
                return Task.FromResult(state);
            });
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            var calendar = new FixedCalendar();
            Add = new AddOrderExpenseHandler(Orders, Reader, Lists, Staff, calendar, Audit, Unit, request, new AddOrderExpenseRequestValidator());
            Update = new UpdateOrderExpenseHandler(Orders, Reader, Lists, Staff, calendar, Audit, Unit, request, new UpdateOrderExpenseRequestValidator());
            Remove = new RemoveOrderExpenseHandler(Orders, Reader, calendar, Audit, Unit, request);
        }

        public Guid OrderId { get; }

        public Guid ExpenseId { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public IOrderLists Lists { get; }

        public IStaffDirectory Staff { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public SaveAwareAudit Audit { get; }

        /// <summary>Gets how many saves had happened each time the order was locked.</summary>
        public List<int> LockedAtSave { get; } = [];

        public AddOrderExpenseHandler Add { get; }

        public UpdateOrderExpenseHandler Update { get; }

        public RemoveOrderExpenseHandler Remove { get; }

        /// <summary>Gets the order instance the handlers worked on last.</summary>
        public Order Last => _loaded[^1];

        public void FailLocks(int count) => _lockFailures = count;

        // Every load gives a fresh copy with the same ids, as a new read from the store would after a rolled back attempt.
        private Order Load(Order seed)
        {
            var copy = Make(seed.Id, seed.Expenses[0].Id);
            _loaded.Add(copy);
            return copy;
        }

        private Order Make(Guid? id, Guid? expenseId)
        {
            var items = new List<NewOrderItem>
            {
                new(JerseyType, "Jersey top", "S-XL", 15, 650.00m),
                new(JerseyType, "Coach polo", "L", 2, 550.00m),
            };
            var details = new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
            var order = Order.Create(new NewOrder(details, OrderStatus.Pending, items), Guid.NewGuid(), Now).Value;
            order.AddExpense(new NewOrderExpense(new DateOnly(2026, 10, 25), 3825m, _savedCategory, "Mesh", _savedPayer), new DateOnly(2026, 10, 28), Now).IsSuccess.ShouldBeTrue();
            typeof(Order).GetProperty(nameof(Order.RowVersion), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, StoredVersion);
            if (id is { } fixedId)
            {
                typeof(Order).GetProperty(nameof(Order.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, fixedId);
                typeof(OrderExpense).GetProperty(nameof(OrderExpense.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order.Expenses[0], expenseId!.Value);
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
            [],
            [],
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
            throw new NotSupportedException("The expense audit entries must join the change's own save.");
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}

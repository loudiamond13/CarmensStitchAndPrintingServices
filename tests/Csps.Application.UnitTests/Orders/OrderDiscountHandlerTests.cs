using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>D-15, ORD-05, ORD-08, D-31: the discount handlers check the form, find the order, compare the version and save once; a remove is read again once after a lost race.</summary>
public sealed class OrderDiscountHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
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

        var result = await harness.Add.HandleAsync(harness.OrderId, AddOrderDiscountRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["kind", "reason", "value", "version"]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Theory]
    [InlineData("fixed", 0, "Enter a discount from ₱0.01 to ₱1,000,000.00.")]
    [InlineData("fixed", 1_000_000.01, "Enter a discount from ₱0.01 to ₱1,000,000.00.")]
    [InlineData("percentage", 0, "Enter a percentage above 0 and up to 100.")]
    [InlineData("percentage", 100.01, "Enter a percentage above 0 and up to 100.")]
    [InlineData("percentage", 7.555, "Use at most 2 decimal places.")]
    [InlineData("fixed", 10.005, "Use at most 2 decimal places.")]
    public async Task AddAValueOutOfRangeOrWithTooManyDecimalsIsA400OnValue(string kind, double value, string message)
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Kind = kind, Value = (decimal)value }, TestContext.Current.CancellationToken);

        Fields(result)["value"].ShouldBe([message]);
    }

    [Fact]
    public async Task AddAnUnknownKindIsA400OnKindAndTheValueIsNotJudgedAgainstAGuess()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Kind = "half", Value = 5_000_000m }, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["kind"]);
        Fields(result)["kind"].ShouldBe(["Choose fixed or percentage."]);
    }

    [Fact]
    public async Task AddAReasonThatIsBlankOrTooLongIsA400OnReason()
    {
        var harness = new Harness();

        var blank = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Reason = "   " }, TestContext.Current.CancellationToken);
        var tooLong = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Reason = new string('a', 101) }, TestContext.Current.CancellationToken);
        var hundred = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Reason = new string('a', 100) }, TestContext.Current.CancellationToken);

        Fields(blank)["reason"].ShouldBe(["Enter a reason for the discount."]);
        Fields(tooLong)["reason"].ShouldBe(["Keep the reason to 100 characters or fewer."]);
        hundred.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public async Task AddSavesOnceInOneTransactionAndReadsTheOrderBack()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Discounts.Count.ShouldBe(3);
        harness.Last.Discounts[2].Reason.ShouldBe("Club member");
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
        harness.Last.Discounts.Count.ShouldBe(2);
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
    public async Task AddToAnUnknownOrderIsA404()
    {
        var harness = new Harness(found: false);

        var result = await harness.Add.HandleAsync(Guid.NewGuid(), ValidAdd(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
        await harness.Reader.DidNotReceiveWithAnyArgs().GetDetailAsync(default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task AddToAnOrderWithTwentyDiscountsIsA422AndNothingIsSaved()
    {
        var harness = new Harness(discountCount: 20);

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Value = 1m }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.TooManyDiscounts);
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddADiscountThatPassesTheItemsTotalIsA400OnValueAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Kind = "fixed", Value = 30_000m }, TestContext.Current.CancellationToken);

        Fields(result)["value"].ShouldBe(["The discounts would be more than the items total. Lower or remove a discount first."]);
        result.Error.Code.ShouldBe("orders.invalid-request");
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AddAnOrderTheReaderCannotFindAfterTheSaveIsA404()
    {
        var harness = new Harness();
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

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstDiscountId, ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateAnEmptyFormListsEveryRequiredFieldIncludingTheVersion()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstDiscountId, UpdateOrderDiscountRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["kind", "reason", "value", "version"]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateSavesTheChangeOnceAndReadsTheOrderBack()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstDiscountId, ValidUpdate(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Discounts[0].Value.ShouldBe(10m);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(harness.OrderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateAStaleVersionIsRefusedAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstDiscountId, ValidUpdate() with { Version = OtherVersionText }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Last.Discounts[0].Value.ShouldBe(5m);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateALostRaceAtSaveTimeIsStaleAndIsNotRetried()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstDiscountId, ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
        await harness.Orders.Received(1).FindAsync(harness.OrderId, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateADiscountThatIsNotOnTheOrderIsA404AndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, Guid.NewGuid(), ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.DiscountNotFound);
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

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstDiscountId, ValidUpdate() with { Value = 5m }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Unit.Commits.ShouldBe(1);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.LockedAtSave.ShouldBeEmpty();
        await harness.Reader.Received(1).GetDetailAsync(harness.OrderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateAValuePastTheItemsTotalIsA400OnValueAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstDiscountId, ValidUpdate() with { Kind = "fixed", Value = 30_000m }, TestContext.Current.CancellationToken);

        Fields(result)["value"].ShouldBe(["The discounts would be more than the items total. Lower or remove a discount first."]);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateANullRequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Update.HandleAsync(harness.OrderId, harness.FirstDiscountId, null!, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task RemoveWithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstDiscountId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task RemoveTakesTheDiscountOutSavesOnceAndReadsTheOrderBack()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstDiscountId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Discounts.Count.ShouldBe(1);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(harness.OrderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemoveADiscountThatIsNotOnTheOrderIsA404()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.DiscountNotFound);
        harness.Unit.Saves.ShouldBe(0);
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

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstDiscountId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        await harness.Orders.Received(2).FindAsync(harness.OrderId, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemoveThatLosesTwoRacesAnswersTheStaleConflict()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstDiscountId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(2);
    }

    [Fact]
    public async Task RemoveAnOrderTheReaderCannotFindAfterTheSaveIsA404()
    {
        var harness = new Harness();
        harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(null));

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstDiscountId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    [Fact]
    public async Task AddRecordsOneAddedEntryForTheOrderBeforeTheSaveWithNoReasonText()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Reason = "Private words" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        var added = harness.Last.Discounts[2];
        entry.Call.ShouldBe(new AuditCall(AuditActions.OrderDiscountAdded, "Order", harness.OrderId.ToString("D"), $"discount={added.Id:D};kind=fixed;value=250.00", Independent: false));
        entry.SavesSoFar.ShouldBe(0);
        entry.Call.Detail.ShouldNotBeNull().ShouldNotContain("Private", Case.Insensitive);
    }

    [Fact]
    public async Task UpdateRecordsOneChangedEntryWithOldAndNewPairs()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.FirstDiscountId, ValidUpdate() with { Reason = "Private words" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.Action.ShouldBe(AuditActions.OrderDiscountChanged);
        entry.Call.TargetType.ShouldBe("Order");
        entry.Call.TargetId.ShouldBe(harness.OrderId.ToString("D"));
        entry.Call.Detail.ShouldBe($"discount={harness.FirstDiscountId:D};kind=percentage;value=5.00>10.00;fields=reason");
        entry.SavesSoFar.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateThatChangesTheKindShowsTheOldAndTheNewKind()
    {
        var harness = new Harness();

        await harness.Update.HandleAsync(harness.OrderId, harness.FirstDiscountId, ValidUpdate() with { Kind = "fixed", Value = 5m, Reason = "League" }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Call.Detail.ShouldBe($"discount={harness.FirstDiscountId:D};kind=percentage>fixed;value=5.00");
    }

    [Fact]
    public async Task RemoveRecordsOneRemovedEntryForTheOrderBeforeTheSave()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.FirstDiscountId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(AuditActions.OrderDiscountRemoved, "Order", harness.OrderId.ToString("D"), $"discount={harness.FirstDiscountId:D};kind=percentage;value=5.00", Independent: false));
        entry.SavesSoFar.ShouldBe(0);
    }

    [Fact]
    public async Task ARemoveThatLosesOneRaceRecordsAnEntryForEachAttemptAndEachJoinsItsOwnSave()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        await harness.Remove.HandleAsync(harness.OrderId, harness.FirstDiscountId, TestContext.Current.CancellationToken);

        harness.Audit.Entries.Select(static entry => entry.SavesSoFar).ShouldBe([0, 1]);
    }

    [Fact]
    public async Task NothingIsRecordedForANoOpEditAStaleVersionAMissingDiscountOrAnOrderRule()
    {
        var noOp = new Harness();
        await noOp.Update.HandleAsync(noOp.OrderId, noOp.FirstDiscountId, ValidUpdate() with { Value = 5m }, TestContext.Current.CancellationToken);
        var stale = new Harness();
        await stale.Update.HandleAsync(stale.OrderId, stale.FirstDiscountId, ValidUpdate() with { Version = OtherVersionText }, TestContext.Current.CancellationToken);
        var missing = new Harness();
        await missing.Remove.HandleAsync(missing.OrderId, Guid.NewGuid(), TestContext.Current.CancellationToken);
        var full = new Harness(discountCount: 20);
        await full.Add.HandleAsync(full.OrderId, ValidAdd() with { Value = 1m }, TestContext.Current.CancellationToken);

        noOp.Audit.Entries.ShouldBeEmpty();
        stale.Audit.Entries.ShouldBeEmpty();
        missing.Audit.Entries.ShouldBeEmpty();
        full.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task EveryChangeLocksTheOrderOnceBeforeTheSave()
    {
        var added = new Harness();
        var edited = new Harness();
        var removed = new Harness();

        await added.Add.HandleAsync(added.OrderId, ValidAdd(), TestContext.Current.CancellationToken);
        await edited.Update.HandleAsync(edited.OrderId, edited.FirstDiscountId, ValidUpdate(), TestContext.Current.CancellationToken);
        await removed.Remove.HandleAsync(removed.OrderId, removed.FirstDiscountId, TestContext.Current.CancellationToken);

        added.LockedAtSave.ShouldBe([0]);
        edited.LockedAtSave.ShouldBe([0]);
        removed.LockedAtSave.ShouldBe([0]);
        await added.Orders.Received(1).LockAsync(added.Last, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AFormSaveThatLosesTheLockIsStaleSavesNothingAndIsNotRetried()
    {
        var add = new Harness();
        add.FailLocks(1);
        var edit = new Harness();
        edit.FailLocks(1);

        var added = await add.Add.HandleAsync(add.OrderId, ValidAdd(), TestContext.Current.CancellationToken);
        var edited = await edit.Update.HandleAsync(edit.OrderId, edit.FirstDiscountId, ValidUpdate(), TestContext.Current.CancellationToken);

        added.Error.ShouldBe(EditErrors.Stale);
        edited.Error.ShouldBe(EditErrors.Stale);
        add.Unit.Saves.ShouldBe(0);
        edit.Unit.Saves.ShouldBe(0);
        add.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ARemoveThatLosesTheLockReadsTheOrderAgainAndDecidesAgain()
    {
        var once = new Harness();
        once.FailLocks(1);
        var twice = new Harness();
        twice.FailLocks(2);

        var recovered = await once.Remove.HandleAsync(once.OrderId, once.FirstDiscountId, TestContext.Current.CancellationToken);
        var gaveUp = await twice.Remove.HandleAsync(twice.OrderId, twice.FirstDiscountId, TestContext.Current.CancellationToken);

        recovered.IsSuccess.ShouldBeTrue();
        once.Unit.Saves.ShouldBe(1);
        gaveUp.Error.ShouldBe(EditErrors.Stale);
        twice.Unit.Saves.ShouldBe(0);
    }

    private static AddOrderDiscountRequest ValidAdd() => new("fixed", 250.00m, "Club member", StoredVersionText);

    private static UpdateOrderDiscountRequest ValidUpdate() => new("percentage", 10m, "League", StoredVersionText);

    private static IReadOnlyDictionary<string, string[]> Fields(Result<OrderDetailResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        return result.Error.FieldErrors.ShouldNotBeNull();
    }

    private sealed class Harness
    {
        private readonly List<Order> _loaded = [];
        private int _lockFailures;

        public Harness(bool noCaller = false, bool found = true, int discountCount = 2)
        {
            Audit = new SaveAwareAudit(Unit);
            var seed = Make(discountCount);
            OrderId = seed.Id;
            FirstDiscountId = seed.Discounts[0].Id;
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
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            var calendar = new FixedCalendar();
            Add = new AddOrderDiscountHandler(Orders, Reader, calendar, Audit, Unit, request, new AddOrderDiscountRequestValidator());
            Update = new UpdateOrderDiscountHandler(Orders, Reader, calendar, Audit, Unit, request, new UpdateOrderDiscountRequestValidator());
            Remove = new RemoveOrderDiscountHandler(Orders, Reader, calendar, Audit, Unit, request);
        }

        public Guid OrderId { get; }

        public Guid FirstDiscountId { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public SaveAwareAudit Audit { get; }

        /// <summary>Gets how many saves had happened each time the order was locked.</summary>
        public List<int> LockedAtSave { get; } = [];

        public AddOrderDiscountHandler Add { get; }

        public UpdateOrderDiscountHandler Update { get; }

        public RemoveOrderDiscountHandler Remove { get; }

        /// <summary>Gets the order instance the handlers worked on last.</summary>
        public Order Last => _loaded[^1];

        public void FailLocks(int count) => _lockFailures = count;

        // Every load gives a fresh copy with the same ids, as a new read from the store would after a rolled back attempt.
        private Order Load(Order seed)
        {
            var copy = Make(seed.Discounts.Count, seed.Id, [.. seed.Discounts.Select(static discount => discount.Id)]);
            _loaded.Add(copy);
            return copy;
        }

        private static Order Make(int discountCount, Guid? id = null, IReadOnlyList<Guid>? discountIds = null)
        {
            var items = new List<NewOrderItem>
            {
                new(JerseyType, "Jersey top", "S-XL", 15, 650.00m),
                new(JerseyType, "Coach polo", "L", 2, 550.00m),
            };
            var details = new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
            var order = Order.Create(new NewOrder(details, OrderStatus.Pending, items), Guid.NewGuid(), Now).Value;
            for (var index = 0; index < discountCount; index++)
            {
                var discount = index == 0
                    ? new NewOrderDiscount(DiscountKind.Percentage, 5m, "League")
                    : new NewOrderDiscount(DiscountKind.Fixed, 1m + index, "Loyal customer");
                order.AddDiscount(discount, Now).IsSuccess.ShouldBeTrue();
            }

            typeof(Order).GetProperty(nameof(Order.RowVersion), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, StoredVersion);
            if (id is { } fixedId)
            {
                typeof(Order).GetProperty(nameof(Order.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, fixedId);
                for (var index = 0; index < order.Discounts.Count; index++)
                {
                    typeof(OrderDiscount).GetProperty(nameof(OrderDiscount.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order.Discounts[index], discountIds![index]);
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
            [],
            [],
            [],
            [],
            new OrderTotalsResponse(0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, 0m, false),
            new ActorRef(CallerId, "Mina Mercado", false),
            Now,
            null,
            null,
            "AAAAAAAAH6Q=",
            new DateOnly(2026, 10, 28));
    }

    // Remembers how many saves had happened when each entry was recorded, so a test can prove the entry joins the change's save.
    private sealed class SaveAwareAudit(FakeUnitOfWork unit) : IAuditTrail
    {
        public List<(AuditCall Call, int SavesSoFar)> Entries { get; } = [];

        public void Record(string action, string? targetType, string? targetId, string? detail) =>
            Entries.Add((new AuditCall(action, targetType, targetId, detail, Independent: false), unit.Saves));

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken) =>
            throw new NotSupportedException("The discount audit entry must join the change's own save.");
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}

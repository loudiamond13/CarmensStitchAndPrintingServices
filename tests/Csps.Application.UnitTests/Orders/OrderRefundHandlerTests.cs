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
using Csps.Domain.Orders;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-05, ORD-08, ORD-18, D-07, D-09, D-30, D-31, D-35: the refund handlers check the form and the refunder, find the order, compare the version and save once.</summary>
public sealed class OrderRefundHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Cash = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");
    private static readonly Guid SavedRefunder = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");
    private static readonly Guid NewRefunder = Guid.Parse("a41d7c92-0b58-4e3f-96d1-8c2e5f7a3b04");
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

        var result = await harness.Add.HandleAsync(harness.OrderId, AddOrderRefundRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "reason", "refundDate", "refundedByUserId", "version"]);
        Fields(result)["reason"].ShouldBe(["Add a short reason for the refund."]);
        Fields(result)["refundedByUserId"].ShouldBe(["Choose who handed the money back."]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddADateThatIsNotARealDayOrIsInTheFutureIsA400OnTheDate()
    {
        var harness = new Harness();

        var notReal = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { RefundDate = "2026-02-30" }, TestContext.Current.CancellationToken);
        var future = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { RefundDate = "2026-10-29" }, TestContext.Current.CancellationToken);
        var today = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { RefundDate = "2026-10-28" }, TestContext.Current.CancellationToken);

        Fields(notReal)["refundDate"].ShouldBe([OrderRules.DateInvalid]);
        Fields(future)["refundDate"].ShouldBe(["The refund date can't be in the future."]);
        today.IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData(0, "Enter an amount from ₱0.01 to ₱1,000,000.00.")]
    [InlineData(-5, "Enter an amount from ₱0.01 to ₱1,000,000.00.")]
    [InlineData(1000000.01, "Enter an amount from ₱0.01 to ₱1,000,000.00.")]
    [InlineData(10.005, "Use at most 2 decimal places.")]
    public async Task AddAnAmountOutOfRangeOrWithTooManyDecimalsIsA400OnAmount(double amount, string message)
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Amount = (decimal)amount }, TestContext.Current.CancellationToken);

        Fields(result)["amount"].ShouldBe([message]);
    }

    [Fact]
    public async Task AddAReasonThatIsEmptyOrOverTwoHundredCharactersIsRefusedAndTwoHundredIsAccepted()
    {
        var harness = new Harness();

        var empty = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Reason = "   " }, TestContext.Current.CancellationToken);
        var tooLong = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Reason = new string('r', 201) }, TestContext.Current.CancellationToken);
        var exact = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Reason = new string('r', 200) }, TestContext.Current.CancellationToken);

        Fields(empty)["reason"].ShouldBe([OrderRules.RefundReasonRequired]);
        Fields(tooLong)["reason"].ShouldBe([OrderRules.RefundReasonTooLong]);
        exact.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public async Task AddARefunderWhoCannotBeChosenIsA400OnTheRefunderAndNothingIsLoaded()
    {
        var harness = new Harness();

        var blocked = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { RefundedByUserId = Blocked }, TestContext.Current.CancellationToken);
        var unknown = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { RefundedByUserId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        Fields(blocked)["refundedByUserId"].ShouldBe([OrderRules.RefundedByInactive]);
        Fields(unknown)["refundedByUserId"].ShouldBe([OrderRules.RefundedByInactive]);
        await harness.Orders.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddSavesTheRefundOnceReadsTheOrderBackAndLocksBeforeTheSave()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Refunds.Count.ShouldBe(2);
        harness.Unit.Saves.ShouldBe(1);
        harness.LockedAtSave.ShouldBe([0]);
        await harness.Reader.Received(1).GetDetailAsync(harness.OrderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddAStaleVersionIsRefusedAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Version = OtherVersionText }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AddAnAmountAboveWhatWasPaidIsA400OnAmountFromTheDomainAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Amount = 9850.01m }, TestContext.Current.CancellationToken);

        Fields(result)["amount"].ShouldBe(["This is more than was paid and not yet refunded. Enter ₱9,850.00 or less."]);
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

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.RefundId, ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateAnEmptyFormListsEveryRequiredFieldIncludingTheVersion()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.RefundId, UpdateOrderRefundRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "reason", "refundDate", "refundedByUserId", "version"]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateKeepingASavedRefunderWhoCanNoLongerBeChosenIsAllowedAndTheDirectoryIsNotAsked()
    {
        var harness = new Harness(savedRefunder: Blocked);

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.RefundId, ValidUpdate() with { RefundedByUserId = Blocked, Amount = 900m }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
        await harness.Staff.DidNotReceive().GetStaffStateAsync(Blocked, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateChangingTheRefunderToSomeoneWhoCannotBeChosenIsA400OnTheRefunder()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.RefundId, ValidUpdate() with { RefundedByUserId = Blocked }, TestContext.Current.CancellationToken);

        Fields(result)["refundedByUserId"].ShouldBe([OrderRules.RefundedByInactive]);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateAStaleVersionIsRefusedAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.RefundId, ValidUpdate() with { Version = OtherVersionText }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateARefundThatIsNotOnTheOrderIsA404AndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, Guid.NewGuid(), ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.RefundNotFound);
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

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.RefundId, ValidUpdate(), TestContext.Current.CancellationToken);

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

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.RefundId, ValidUpdate() with { Amount = 900m }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task UpdateANullRequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Update.HandleAsync(harness.OrderId, harness.RefundId, null!, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AddRecordsOneAddedEntryForTheOrderBeforeTheSaveWithNoReasonText()
    {
        var harness = new Harness();

        await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Reason = "Private words" }, TestContext.Current.CancellationToken);

        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.OrderRefundAdded,
            "Order",
            harness.OrderId.ToString("D"),
            $"refund={harness.Last.Refunds[^1].Id:D};date=2026-10-27;amount=500.00;refunder={NewRefunder:D}",
            Independent: false));
        entry.SavesSoFar.ShouldBe(0);
        entry.Call.Detail.ShouldNotBeNull().ShouldNotContain("Private", Case.Insensitive);
    }

    [Fact]
    public async Task UpdateOfTheAmountAndTheRefunderRecordsAChangedEntryThenARefunderChangedEntryBeforeTheSave()
    {
        var harness = new Harness();

        await harness.Update.HandleAsync(harness.OrderId, harness.RefundId, ValidUpdate() with { Amount = 900m, RefundedByUserId = NewRefunder, Reason = "Private words" }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.Select(static entry => entry.Call.Action).ShouldBe([AuditActions.OrderRefundChanged, AuditActions.OrderRefundRefunderChanged]);
        harness.Audit.Entries[0].Call.Detail.ShouldBe($"refund={harness.RefundId:D};date=2026-10-27;amount=1000.00>900.00;refunder={NewRefunder:D};fields=reason");
        harness.Audit.Entries[1].Call.Detail.ShouldBe($"refund={harness.RefundId:D};refunder={SavedRefunder:D}>{NewRefunder:D}");
        harness.Audit.Entries.ShouldAllBe(entry => entry.SavesSoFar == 0 && !entry.Call.Detail!.Contains("Private", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task UpdateOfOnlyTheRefunderRecordsOnlyARefunderChangedEntry()
    {
        var harness = new Harness();

        await harness.Update.HandleAsync(harness.OrderId, harness.RefundId, ValidUpdate() with { RefundedByUserId = NewRefunder }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Call.Action.ShouldBe(AuditActions.OrderRefundRefunderChanged);
    }

    [Fact]
    public async Task UpdateOfOnlyTheAmountRecordsOnlyAChangedEntry()
    {
        var harness = new Harness();

        await harness.Update.HandleAsync(harness.OrderId, harness.RefundId, ValidUpdate() with { Amount = 900m }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Call.Action.ShouldBe(AuditActions.OrderRefundChanged);
    }

    [Fact]
    public async Task RemoveRecordsOneRemovedEntryForTheOrderBeforeTheSave()
    {
        var harness = new Harness();

        await harness.Remove.HandleAsync(harness.OrderId, harness.RefundId, TestContext.Current.CancellationToken);

        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.OrderRefundRemoved,
            "Order",
            harness.OrderId.ToString("D"),
            $"refund={harness.RefundId:D};date=2026-10-27;amount=1000.00;refunder={SavedRefunder:D}",
            Independent: false));
        entry.SavesSoFar.ShouldBe(0);
    }

    [Fact]
    public async Task RemoveWithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.RefundId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task RemoveTakesTheRefundOutAndSavesOnceAfterTheLock()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.RefundId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Refunds.ShouldBeEmpty();
        harness.Last.RefundedTotal.ShouldBe(0m);
        harness.Unit.Saves.ShouldBe(1);
        harness.LockedAtSave.ShouldBe([0]);
    }

    [Fact]
    public async Task RemoveARefundThatIsNotOnTheOrderIsA404()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.RefundNotFound);
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

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.RefundId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        await harness.Orders.Received(2).FindAsync(harness.OrderId, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemoveThatLosesTwoRacesAnswersTheStaleConflict()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.RefundId, TestContext.Current.CancellationToken);

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
        var edited = await edit.Update.HandleAsync(edit.OrderId, edit.RefundId, ValidUpdate() with { Amount = 900m }, TestContext.Current.CancellationToken);

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

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.RefundId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    private static AddOrderRefundRequest ValidAdd() =>
        new("2026-10-27", 500.00m, "Order cancelled by the team", NewRefunder, StoredVersionText);

    private static UpdateOrderRefundRequest ValidUpdate() =>
        new("2026-10-27", 1000.00m, "Order cancelled by the team", SavedRefunder, StoredVersionText);

    private static IReadOnlyDictionary<string, string[]> Fields(Result<OrderDetailResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        return result.Error.FieldErrors.ShouldNotBeNull();
    }

    private sealed class Harness
    {
        private readonly List<Order> _loaded = [];
        private readonly Guid _savedRefunder;
        private int _lockFailures;

        public Harness(bool noCaller = false, bool found = true, Guid? savedRefunder = null)
        {
            _savedRefunder = savedRefunder ?? SavedRefunder;
            Audit = new SaveAwareAudit(Unit);
            var seed = Make(null, null);
            OrderId = seed.Id;
            RefundId = seed.Refunds[0].Id;
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
            Staff = Substitute.For<IStaffDirectory>();
            Staff.GetStaffStateAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                var id = call.Arg<Guid>();
                StaffState? state = id == SavedRefunder || id == NewRefunder
                    ? new StaffState(id, "Mina Mercado", Roles.Manager, true, false, false, true)
                    : id == Blocked ? new StaffState(id, "Dee Dizon", Roles.Admin, false, false, false, true) : null;
                return Task.FromResult(state);
            });
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            var calendar = new FixedCalendar();
            Add = new AddOrderRefundHandler(Orders, Reader, Staff, calendar, Audit, Unit, request, new AddOrderRefundRequestValidator());
            Update = new UpdateOrderRefundHandler(Orders, Reader, Staff, calendar, Audit, Unit, request, new UpdateOrderRefundRequestValidator());
            Remove = new RemoveOrderRefundHandler(Orders, Reader, calendar, Audit, Unit, request);
        }

        public Guid OrderId { get; }

        public Guid RefundId { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public IStaffDirectory Staff { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public SaveAwareAudit Audit { get; }

        /// <summary>Gets how many saves had happened each time the order was locked.</summary>
        public List<int> LockedAtSave { get; } = [];

        public AddOrderRefundHandler Add { get; }

        public UpdateOrderRefundHandler Update { get; }

        public RemoveOrderRefundHandler Remove { get; }

        /// <summary>Gets the order instance the handlers worked on last.</summary>
        public Order Last => _loaded[^1];

        public void FailLocks(int count) => _lockFailures = count;

        // Every load gives a fresh copy with the same ids, as a new read from the store would after a rolled back attempt.
        private Order Load(Order seed)
        {
            var copy = Make(seed.Id, seed.Refunds[0].Id);
            _loaded.Add(copy);
            return copy;
        }

        // A cancelled order, paid 10,850.00 in full, with one refund of 1,000.00.
        private Order Make(Guid? id, Guid? refundId)
        {
            var today = new DateOnly(2026, 10, 28);
            var items = new List<NewOrderItem>
            {
                new(JerseyType, "Jersey top", "S-XL", 15, 650.00m),
                new(JerseyType, "Coach polo", "L", 2, 550.00m),
            };
            var details = new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, today, new DateOnly(2026, 11, 11), null);
            var input = new NewOrder(details, OrderStatus.Pending, items) { Payments = [new NewOrderPayment(today, 10850.00m, Cash, null, null, CallerId)] };
            var order = Order.Create(input, CallerId, Now, today).Value;
            order.ChangeStatus(OrderStatus.Cancelled, CallerId, Now).IsSuccess.ShouldBeTrue();
            order.AddRefund(new NewOrderRefund(new DateOnly(2026, 10, 27), 1000.00m, "Order cancelled by the team", _savedRefunder), today, Now).IsSuccess.ShouldBeTrue();
            typeof(Order).GetProperty(nameof(Order.RowVersion), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, StoredVersion);
            if (id is { } fixedId)
            {
                typeof(Order).GetProperty(nameof(Order.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, fixedId);
                typeof(OrderRefund).GetProperty(nameof(OrderRefund.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order.Refunds[0], refundId!.Value);
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
            "cancelled",
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
            throw new NotSupportedException("The refund audit entries must join the change's own save.");
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}

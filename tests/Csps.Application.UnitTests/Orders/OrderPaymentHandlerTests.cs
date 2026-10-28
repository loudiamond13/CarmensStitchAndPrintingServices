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
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-05, ORD-08, ORD-22, D-11, D-16, D-31: the payment handlers check the form, the method and the receiver, find the order, compare the version and save once.</summary>
public sealed class OrderPaymentHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Cash = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");
    private static readonly Guid GCash = Guid.Parse("01a17fce-7807-751a-bb7b-3719f2840928");
    private static readonly Guid Retired = Guid.Parse("5b3e8a14-6c27-4d90-a1f5-0e9c7d2b4a68");
    private static readonly Guid SavedReceiver = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");
    private static readonly Guid NewReceiver = Guid.Parse("a41d7c92-0b58-4e3f-96d1-8c2e5f7a3b04");
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

        var result = await harness.Add.HandleAsync(harness.OrderId, AddOrderPaymentRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "paymentDate", "paymentMethodId", "receivedByUserId", "version"]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AddAPaymentDateThatIsNotARealDayOrIsInTheFutureIsA400OnThePaymentDate()
    {
        var harness = new Harness();

        var notReal = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { PaymentDate = "2026-02-30" }, TestContext.Current.CancellationToken);
        var future = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { PaymentDate = "2026-10-29" }, TestContext.Current.CancellationToken);
        var today = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { PaymentDate = "2026-10-28" }, TestContext.Current.CancellationToken);

        Fields(notReal)["paymentDate"].ShouldBe(["Enter a real date."]);
        Fields(future)["paymentDate"].ShouldBe(["The payment date can't be in the future."]);
        today.IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData(0, "Enter an amount from ₱0.01 to ₱1,000,000.00.")]
    [InlineData(1_000_000.01, "Enter an amount from ₱0.01 to ₱1,000,000.00.")]
    [InlineData(10.005, "Use at most 2 decimal places.")]
    public async Task AddAnAmountOutOfRangeOrWithTooManyDecimalsIsA400OnAmount(double amount, string message)
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Amount = (decimal)amount }, TestContext.Current.CancellationToken);

        Fields(result)["amount"].ShouldBe([message]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AddAReferenceOverOneHundredAndNotesOverFiveHundredAreRefused()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(
            harness.OrderId,
            ValidAdd() with { Reference = new string('r', 101), Notes = new string('n', 501) },
            TestContext.Current.CancellationToken);

        var fields = Fields(result);
        fields["reference"].ShouldBe(["Keep the reference to 100 characters or fewer."]);
        fields["notes"].ShouldBe(["Keep notes to 500 characters or fewer."]);
    }

    [Fact]
    public async Task AddARetiredPaymentMethodIsA400OnThePaymentMethodAndNothingIsLoaded()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { PaymentMethodId = Retired }, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["paymentMethodId"]);
        Fields(result)["paymentMethodId"].ShouldBe(["This payment method was retired. Choose another one."]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AddAnUnknownPaymentMethodIsA400WithTheChooseMessage()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { PaymentMethodId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        Fields(result)["paymentMethodId"].ShouldBe(["Choose a payment method."]);
    }

    [Fact]
    public async Task AddAReceiverWhoCannotBeChosenIsA400OnTheReceiver()
    {
        var harness = new Harness();

        var blocked = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { ReceivedByUserId = Blocked }, TestContext.Current.CancellationToken);
        var unknown = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { ReceivedByUserId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        Fields(blocked).Keys.ShouldBe(["receivedByUserId"]);
        Fields(blocked)["receivedByUserId"].ShouldBe(["This person can't be chosen because their account isn't active. Choose someone else."]);
        Fields(unknown)["receivedByUserId"].ShouldBe(["This person can't be chosen because their account isn't active. Choose someone else."]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AddAMethodAndAReceiverThatFailAreListedInTheSame400()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(
            harness.OrderId,
            ValidAdd() with { PaymentMethodId = Retired, ReceivedByUserId = Blocked, Amount = 0m },
            TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "paymentMethodId", "receivedByUserId"]);
    }

    [Fact]
    public async Task AddSavesThePaymentOnceAndReadsTheOrderBack()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Payments.Count.ShouldBe(2);
        harness.Last.PaidTotal.ShouldBe(10500m);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(harness.OrderId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddAPaymentAboveTheBalanceIsA400OnAmountAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Amount = 850.01m }, TestContext.Current.CancellationToken);

        Fields(result)["amount"].ShouldBe(["This is more than the balance. Enter ₱850.00 or less."]);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
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

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateAnEmptyFormListsEveryRequiredFieldIncludingTheVersion()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, UpdateOrderPaymentRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "paymentDate", "paymentMethodId", "receivedByUserId", "version"]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task UpdateKeepingASavedRetiredPaymentMethodIsAllowedAndTheListIsNotAsked()
    {
        var harness = new Harness(savedMethod: Retired);

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, ValidUpdate() with { PaymentMethodId = Retired, Amount = 9000m }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Payments[0].Amount.ShouldBe(9000m);
        await harness.Lists.DidNotReceiveWithAnyArgs().GetStatesAsync(default, default!, default);
    }

    [Fact]
    public async Task UpdateSwitchingToARetiredPaymentMethodIsA400AndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, ValidUpdate() with { PaymentMethodId = Retired }, TestContext.Current.CancellationToken);

        Fields(result)["paymentMethodId"].ShouldBe(["This payment method was retired. Choose another one."]);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateKeepingASavedReceiverWhoCanNoLongerBeChosenIsAllowedAndTheDirectoryIsNotAsked()
    {
        var harness = new Harness(savedReceiver: Blocked);

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, ValidUpdate() with { ReceivedByUserId = Blocked, Amount = 9000m }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Payments[0].ReceivedByUserId.ShouldBe(Blocked);
        await harness.Staff.DidNotReceiveWithAnyArgs().GetStaffStateAsync(default, default);
    }

    [Fact]
    public async Task UpdateChangingTheReceiverToSomeoneWhoCannotBeChosenIsA400OnTheReceiver()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, ValidUpdate() with { ReceivedByUserId = Blocked }, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["receivedByUserId"]);
        Fields(result)["receivedByUserId"].ShouldBe(["This person can't be chosen because their account isn't active. Choose someone else."]);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateRaisingThePaymentAboveTheBalancePlusItsOldAmountIsA400OnAmount()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, ValidUpdate() with { Amount = 10850.01m }, TestContext.Current.CancellationToken);

        Fields(result)["amount"].ShouldBe(["This is more than the balance. Enter ₱10,850.00 or less."]);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateAStaleVersionIsRefusedAndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, ValidUpdate() with { Version = OtherVersionText }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task UpdateAPaymentThatIsNotOnTheOrderIsA404AndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(harness.OrderId, Guid.NewGuid(), ValidUpdate(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.PaymentNotFound);
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

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, ValidUpdate(), TestContext.Current.CancellationToken);

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

        var result = await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, ValidUpdate() with { Amount = 9000m }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task UpdateANullRequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, null!, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AddRecordsOneAddedEntryForTheOrderBeforeTheSaveWithNoReferenceOrNotesText()
    {
        var harness = new Harness();

        var result = await harness.Add.HandleAsync(harness.OrderId, ValidAdd() with { Reference = "Private ref", Notes = "Private words" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        var added = harness.Last.Payments[1];
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.OrderPaymentAdded,
            "Order",
            harness.OrderId.ToString("D"),
            $"payment={added.Id:D};date=2026-10-27;amount=500.00;method={Cash:D};receiver={NewReceiver:D}",
            Independent: false));
        entry.SavesSoFar.ShouldBe(0);
        entry.Call.Detail.ShouldNotBeNull().ShouldNotContain("Private", Case.Insensitive);
    }

    [Fact]
    public async Task UpdateOfTheAmountAndTheReceiverRecordsAChangedEntryThenAReceiverChangedEntryBeforeTheSave()
    {
        var harness = new Harness();

        var result = await harness.Update.HandleAsync(
            harness.OrderId,
            harness.PaymentId,
            ValidUpdate() with { Amount = 9000m, Notes = "Private words", ReceivedByUserId = NewReceiver },
            TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.Select(static entry => entry.Call.Action).ShouldBe([AuditActions.OrderPaymentChanged, AuditActions.OrderPaymentReceiverChanged]);
        harness.Audit.Entries.ShouldAllBe(entry => entry.SavesSoFar == 0 && entry.Call.TargetType == "Order" && entry.Call.TargetId == harness.OrderId.ToString("D"));
        harness.Audit.Entries[0].Call.Detail.ShouldBe(
            $"payment={harness.PaymentId:D};date=2026-10-25;amount=10000.00>9000.00;method={Cash:D};receiver={NewReceiver:D};fields=notes");
        harness.Audit.Entries[1].Call.Detail.ShouldBe($"payment={harness.PaymentId:D};receiver={SavedReceiver:D}>{NewReceiver:D}");
        harness.Audit.Entries.ShouldAllBe(entry => !entry.Call.Detail!.Contains("Private", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task UpdateOfOnlyTheReceiverRecordsOnlyAReceiverChangedEntry()
    {
        var harness = new Harness();

        await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, ValidUpdate() with { ReceivedByUserId = NewReceiver }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Call.Action.ShouldBe(AuditActions.OrderPaymentReceiverChanged);
    }

    [Fact]
    public async Task UpdateOfOnlyTheAmountRecordsOnlyAChangedEntry()
    {
        var harness = new Harness();

        await harness.Update.HandleAsync(harness.OrderId, harness.PaymentId, ValidUpdate() with { Amount = 9000m }, TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Call.Action.ShouldBe(AuditActions.OrderPaymentChanged);
    }

    [Fact]
    public async Task RemoveWithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.PaymentId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task RemoveTakesThePaymentOutRecordsOneRemovedEntryAndSavesOnce()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.PaymentId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Last.Payments.ShouldBeEmpty();
        harness.Last.Balance.ShouldBe(10850m);
        harness.Unit.Saves.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.OrderPaymentRemoved,
            "Order",
            harness.OrderId.ToString("D"),
            $"payment={harness.PaymentId:D};date=2026-10-25;amount=10000.00;method={Cash:D};receiver={SavedReceiver:D}",
            Independent: false));
        entry.SavesSoFar.ShouldBe(0);
        harness.LockedAtSave.ShouldBe([0]);
    }

    [Fact]
    public async Task RemoveAPaymentThatIsNotOnTheOrderIsA404()
    {
        var harness = new Harness();

        var result = await harness.Remove.HandleAsync(harness.OrderId, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.PaymentNotFound);
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

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.PaymentId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
        await harness.Orders.Received(2).FindAsync(harness.OrderId, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemoveThatLosesTwoRacesAnswersTheStaleConflict()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.PaymentId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(2);
    }

    [Fact]
    public async Task RemoveThatLosesTheLockReadsTheOrderAgainAndGivesUpAfterTwo()
    {
        var once = new Harness();
        once.FailLocks(1);
        var twice = new Harness();
        twice.FailLocks(2);

        var recovered = await once.Remove.HandleAsync(once.OrderId, once.PaymentId, TestContext.Current.CancellationToken);
        var gaveUp = await twice.Remove.HandleAsync(twice.OrderId, twice.PaymentId, TestContext.Current.CancellationToken);

        recovered.IsSuccess.ShouldBeTrue();
        gaveUp.Error.ShouldBe(EditErrors.Stale);
        twice.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AFormSaveThatLosesTheLockIsStaleSavesNothingAndIsNotRetried()
    {
        var add = new Harness();
        add.FailLocks(1);
        var edit = new Harness();
        edit.FailLocks(1);

        var added = await add.Add.HandleAsync(add.OrderId, ValidAdd(), TestContext.Current.CancellationToken);
        var edited = await edit.Update.HandleAsync(edit.OrderId, edit.PaymentId, ValidUpdate() with { Amount = 9000m }, TestContext.Current.CancellationToken);

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

        var result = await harness.Remove.HandleAsync(harness.OrderId, harness.PaymentId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    private static AddOrderPaymentRequest ValidAdd() =>
        new("2026-10-27", 500.00m, Cash, null, null, NewReceiver, StoredVersionText);

    private static UpdateOrderPaymentRequest ValidUpdate() =>
        new("2026-10-25", 10000.00m, Cash, null, null, SavedReceiver, StoredVersionText);

    private static IReadOnlyDictionary<string, string[]> Fields(Result<OrderDetailResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        return result.Error.FieldErrors.ShouldNotBeNull();
    }

    private sealed class Harness
    {
        private readonly List<Order> _loaded = [];
        private readonly Guid _savedMethod;
        private readonly Guid _savedReceiver;
        private int _lockFailures;

        public Harness(bool noCaller = false, bool found = true, Guid? savedMethod = null, Guid? savedReceiver = null)
        {
            _savedMethod = savedMethod ?? Cash;
            _savedReceiver = savedReceiver ?? SavedReceiver;
            Audit = new SaveAwareAudit(Unit);
            var seed = Make(null, null);
            OrderId = seed.Id;
            PaymentId = seed.Payments[0].Id;
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
            Lists.GetStatesAsync(OrderListKind.PaymentMethod, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                var ids = call.Arg<IReadOnlyCollection<Guid>>();
                IReadOnlyList<OrderListEntryState> states =
                [
                    .. ids.Where(static id => id == Cash || id == GCash || id == Retired).Select(static id => new OrderListEntryState(id, "Method", id == Retired)),
                ];
                return Task.FromResult(states);
            });
            Staff = Substitute.For<IStaffDirectory>();
            Staff.GetStaffStateAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                var id = call.Arg<Guid>();
                StaffState? state = id == SavedReceiver || id == NewReceiver
                    ? new StaffState(id, "Mina Mercado", Roles.Manager, true, false, false, true)
                    : id == Blocked ? new StaffState(id, "Dee Dizon", Roles.Admin, false, false, false, true) : null;
                return Task.FromResult(state);
            });
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            var calendar = new FixedCalendar();
            Add = new AddOrderPaymentHandler(Orders, Reader, Lists, Staff, calendar, Audit, Unit, request, new AddOrderPaymentRequestValidator());
            Update = new UpdateOrderPaymentHandler(Orders, Reader, Lists, Staff, calendar, Audit, Unit, request, new UpdateOrderPaymentRequestValidator());
            Remove = new RemoveOrderPaymentHandler(Orders, Reader, calendar, Audit, Unit, request);
        }

        public Guid OrderId { get; }

        public Guid PaymentId { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public IOrderLists Lists { get; }

        public IStaffDirectory Staff { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public SaveAwareAudit Audit { get; }

        /// <summary>Gets how many saves had happened each time the order was locked.</summary>
        public List<int> LockedAtSave { get; } = [];

        public AddOrderPaymentHandler Add { get; }

        public UpdateOrderPaymentHandler Update { get; }

        public RemoveOrderPaymentHandler Remove { get; }

        /// <summary>Gets the order instance the handlers worked on last.</summary>
        public Order Last => _loaded[^1];

        public void FailLocks(int count) => _lockFailures = count;

        // Every load gives a fresh copy with the same ids, as a new read from the store would after a rolled back attempt.
        private Order Load(Order seed)
        {
            var copy = Make(seed.Id, seed.Payments[0].Id);
            _loaded.Add(copy);
            return copy;
        }

        private Order Make(Guid? id, Guid? paymentId)
        {
            var items = new List<NewOrderItem>
            {
                new(JerseyType, "Jersey top", "S-XL", 15, 650.00m),
                new(JerseyType, "Coach polo", "L", 2, 550.00m),
            };
            var details = new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
            var order = Order.Create(new NewOrder(details, OrderStatus.Pending, items), Guid.NewGuid(), Now).Value;
            order.AddPayment(new NewOrderPayment(new DateOnly(2026, 10, 25), 10000m, _savedMethod, null, null, _savedReceiver), new DateOnly(2026, 10, 28), Now).IsSuccess.ShouldBeTrue();
            typeof(Order).GetProperty(nameof(Order.RowVersion), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, StoredVersion);
            if (id is { } fixedId)
            {
                typeof(Order).GetProperty(nameof(Order.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, fixedId);
                typeof(OrderPayment).GetProperty(nameof(OrderPayment.Id), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order.Payments[0], paymentId!.Value);
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
            throw new NotSupportedException("The payment audit entries must join the change's own save.");
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}

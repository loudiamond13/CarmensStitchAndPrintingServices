using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace Csps.Application.UnitTests.Orders;

/// <summary>
/// ORD-21, ORD-14, D-32, D-37: the import handler checks that every list entry and person the order names exists, lets the named
/// relaxations decide about retired entries, the Legacy holder and inactive staff, refuses a number that is taken, and takes the
/// order number lock only after every check passed.
/// </summary>
public sealed class ImportOrderHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid ProductTypeId = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid OtherProductTypeId = Guid.Parse("01a17fce-7801-7e45-b875-357767854eda");
    private static readonly Guid RetiredProductTypeId = Guid.Parse("a3f6c1d2-4b78-4e95-8c10-2d7e9b5a6f31");
    private static readonly Guid CashId = Guid.Parse("01a17fce-7806-77e1-91b7-d3b852f2fd1d");
    private static readonly Guid RetiredMethodId = Guid.Parse("5b3e8a14-6c27-4d90-a1f5-0e9c7d2b4a68");
    private static readonly Guid FabricId = Guid.Parse("01a17fce-780b-75d1-89e0-5b3b9b185a2c");
    private static readonly Guid RetiredCategoryId = Guid.Parse("8e2c5a47-1d93-4b60-a7f4-6c0d9b3e5a12");
    private static readonly Guid UnknownId = Guid.Parse("c0de0b13-72a4-4f58-8c1d-3a5b7e9f0c26");
    private static readonly Guid ActiveId = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");
    private static readonly Guid OtherActiveId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid InactiveId = Guid.Parse("d6e90b13-72a4-4f58-8c1d-3a5b7e9f0c26");

    [Fact]
    public async Task AValidSnapshotIsSavedOnceInOneTransactionAfterTheNumberIsReserved()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid(), OrderImportRules.Default, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var order = harness.Orders.ReceivedCalls().Where(call => call.GetMethodInfo().Name == nameof(IOrders.Add)).Select(call => (Order)call.GetArguments()[0]!).ShouldHaveSingleItem();
        order.Id.ShouldBe(result.Value);
        order.Number.ShouldBe("ORD-2026-0148");
        await harness.Numbers.Received(1).ReserveLegacyAsync("ORD-2026-0148", Now, Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(0);
    }

    [Fact]
    public async Task TheStrictRulesAcceptASnapshotWhoseEntriesAndPeopleCanAllBeChosen()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid(), OrderImportRules.Strict, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public async Task EveryUnknownListEntryIsRefusedOnItsOwnPathAndNothingIsLockedOrSaved()
    {
        var harness = new Harness();
        var snapshot = Valid() with
        {
            Items = [Item(ProductTypeId), Item(UnknownId)],
            Payments = [Payment(ActiveId) with { PaymentMethodId = UnknownId }],
            Expenses = [Expense(ActiveId) with { OrderExpenseCategoryId = UnknownId }],
        };

        var result = await harness.Handler.HandleAsync(snapshot, OrderImportRules.Default, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["expenses[0].orderExpenseCategoryId", "items[1].productTypeId", "payments[0].paymentMethodId"]);
        Fields(result)["items[1].productTypeId"].ShouldBe([OrderRules.ProductTypeRequired]);
        Fields(result)["payments[0].paymentMethodId"].ShouldBe([OrderRules.PaymentMethodRequired]);
        Fields(result)["expenses[0].orderExpenseCategoryId"].ShouldBe([OrderRules.ExpenseCategoryRequired]);
        harness.Numbers.ReceivedCalls().ShouldBeEmpty();
        harness.Orders.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ARetiredListEntryIsAcceptedByTheDefaultRulesAndRefusedByTheStrictRules()
    {
        var harness = new Harness();
        var snapshot = Valid() with
        {
            Items = [Item(RetiredProductTypeId)],
            Payments = [Payment(ActiveId) with { PaymentMethodId = RetiredMethodId }],
            Expenses = [Expense(ActiveId) with { OrderExpenseCategoryId = RetiredCategoryId }],
        };

        var lenient = await harness.Handler.HandleAsync(snapshot, OrderImportRules.Default, TestContext.Current.CancellationToken);
        var strict = await harness.Handler.HandleAsync(snapshot, OrderImportRules.Strict, TestContext.Current.CancellationToken);

        lenient.IsSuccess.ShouldBeTrue();
        Fields(strict).Keys.Order(StringComparer.Ordinal).ShouldBe(["expenses[0].orderExpenseCategoryId", "items[0].productTypeId", "payments[0].paymentMethodId"]);
        Fields(strict)["items[0].productTypeId"].ShouldBe([OrderRules.ProductTypeRetired]);
        Fields(strict)["payments[0].paymentMethodId"].ShouldBe([OrderRules.PaymentMethodRetired]);
        Fields(strict)["expenses[0].orderExpenseCategoryId"].ShouldBe([OrderRules.ExpenseCategoryRetired]);
    }

    [Fact]
    public async Task AnUnknownPersonIsRefusedOnTheFieldThatNamesThem()
    {
        var harness = new Harness();
        var snapshot = Valid() with
        {
            Payments = [Payment(UnknownId)],
            Refunds = [Refund(UnknownId)],
            Expenses = [Expense(UnknownId)],
            StatusHistory = [new ImportedStatusChange(null, OrderStatus.InProduction, UnknownId, Now)],
        };

        var result = await harness.Handler.HandleAsync(snapshot, OrderImportRules.Default, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal)
            .ShouldBe(["expenses[0].paidByUserId", "payments[0].receivedByUserId", "refunds[0].refundedByUserId", "statusHistory[0].changedById"]);
        Fields(result)["payments[0].receivedByUserId"].ShouldBe([OrderRules.ReceivedByRequired]);
        Fields(result)["refunds[0].refundedByUserId"].ShouldBe([OrderRules.RefundedByRequired]);
        Fields(result)["expenses[0].paidByUserId"].ShouldBe([OrderRules.PaidByRequired]);
        Fields(result)["statusHistory[0].changedById"].ShouldBe([OrderErrors.HistoryPersonUnknownMessage]);
        harness.Numbers.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task TheLegacyHolderIsAcceptedByTheDefaultRulesAndRefusedByTheStrictRules()
    {
        var harness = new Harness();
        var snapshot = Valid() with
        {
            Payments = [Payment(LegacyHolder.Id)],
            Refunds = [Refund(LegacyHolder.Id)],
            Expenses = [Expense(LegacyHolder.Id)],
            StatusHistory = [new ImportedStatusChange(null, OrderStatus.InProduction, LegacyHolder.Id, Now)],
        };

        var lenient = await harness.Handler.HandleAsync(snapshot, OrderImportRules.Default, TestContext.Current.CancellationToken);
        var strict = await harness.Handler.HandleAsync(snapshot, OrderImportRules.Strict, TestContext.Current.CancellationToken);

        lenient.IsSuccess.ShouldBeTrue();
        Fields(strict).Keys.Order(StringComparer.Ordinal)
            .ShouldBe(["expenses[0].paidByUserId", "payments[0].receivedByUserId", "refunds[0].refundedByUserId", "statusHistory[0].changedById"]);
        Fields(strict)["payments[0].receivedByUserId"].ShouldBe([OrderRules.ReceivedByInactive]);
        Fields(strict)["refunds[0].refundedByUserId"].ShouldBe([OrderRules.RefundedByInactive]);
        Fields(strict)["expenses[0].paidByUserId"].ShouldBe([OrderRules.PaidByInactive]);
        Fields(strict)["statusHistory[0].changedById"].ShouldBe([OrderRules.ReceivedByInactive]);
        await harness.Staff.DidNotReceive().GetStaffStateAsync(LegacyHolder.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnInactiveAdminIsAcceptedByTheDefaultRulesAndRefusedByTheStrictRules()
    {
        var harness = new Harness();
        var snapshot = Valid() with
        {
            Payments = [Payment(InactiveId)],
            Refunds = [Refund(InactiveId)],
            Expenses = [Expense(InactiveId)],
            StatusHistory = [new ImportedStatusChange(null, OrderStatus.InProduction, InactiveId, Now)],
        };

        var lenient = await harness.Handler.HandleAsync(snapshot, OrderImportRules.Default, TestContext.Current.CancellationToken);
        var strict = await harness.Handler.HandleAsync(snapshot, OrderImportRules.Strict, TestContext.Current.CancellationToken);

        lenient.IsSuccess.ShouldBeTrue();
        Fields(strict).Keys.Order(StringComparer.Ordinal)
            .ShouldBe(["expenses[0].paidByUserId", "payments[0].receivedByUserId", "refunds[0].refundedByUserId", "statusHistory[0].changedById"]);
        Fields(strict)["payments[0].receivedByUserId"].ShouldBe([OrderRules.ReceivedByInactive]);
    }

    [Fact]
    public async Task EachListAndEachPersonIsLookedUpOnceForTheDistinctIds()
    {
        var harness = new Harness();
        var snapshot = Valid() with
        {
            Items = [Item(ProductTypeId), Item(OtherProductTypeId), Item(ProductTypeId)],
            Payments = [Payment(ActiveId), Payment(ActiveId), Payment(OtherActiveId)],
            Refunds = [Refund(ActiveId)],
            Expenses = [Expense(OtherActiveId)],
            StatusHistory = [new ImportedStatusChange(null, OrderStatus.Pending, null, Now), new ImportedStatusChange(OrderStatus.Pending, OrderStatus.InProduction, ActiveId, Now)],
        };

        var result = await harness.Handler.HandleAsync(snapshot, OrderImportRules.Default, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Lists.Received(1).GetStatesAsync(OrderListKind.ProductType, Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 2), Arg.Any<CancellationToken>());
        await harness.Lists.Received(1).GetStatesAsync(OrderListKind.PaymentMethod, Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 1), Arg.Any<CancellationToken>());
        await harness.Lists.Received(1).GetStatesAsync(OrderListKind.OrderExpenseCategory, Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 1), Arg.Any<CancellationToken>());
        await harness.Staff.Received(1).GetStaffStateAsync(ActiveId, Arg.Any<CancellationToken>());
        await harness.Staff.Received(1).GetStaffStateAsync(OtherActiveId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnOrderWithNoPaymentsOrExpensesLooksUpOnlyTheProductTypes()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new OrderImportSnapshot("ORD-2026-0150", Details(), OrderStatus.Pending, [Item(ProductTypeId)]), OrderImportRules.Default, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Lists.Received(1).GetStatesAsync(OrderListKind.ProductType, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
        await harness.Lists.DidNotReceive().GetStatesAsync(OrderListKind.PaymentMethod, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
        await harness.Lists.DidNotReceive().GetStatesAsync(OrderListKind.OrderExpenseCategory, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
        harness.Staff.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task ATakenNumberIsA422OrdersNumberTakenAndNothingIsLockedOrSaved()
    {
        var harness = new Harness();
        harness.Orders.NumberTakenAsync("ORD-2026-0148", Arg.Any<CancellationToken>()).Returns(true);

        var result = await harness.Handler.HandleAsync(Valid(), OrderImportRules.Default, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("orders.number-taken");
        result.Error.Message.ShouldBe("This order number is already used.");
        harness.Numbers.ReceivedCalls().ShouldBeEmpty();
        harness.Orders.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ANumberTakenInTheMomentBeforeTheSaveIsTheSame422AndTheTransactionRollsBack()
    {
        var harness = new Harness();
        harness.Unit.ThrowOnSave(new OrderNumberTakenException());

        var result = await harness.Handler.HandleAsync(Valid(), OrderImportRules.Default, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NumberTaken);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Theory]
    [InlineData(OrderListKind.ProductType, "items", "This product type was deleted.")]
    [InlineData(OrderListKind.PaymentMethod, "payments", "This payment method was deleted.")]
    [InlineData(OrderListKind.OrderExpenseCategory, "expenses", "This category was deleted.")]
    public async Task AnEntryDeletedInTheMomentBeforeTheSaveIsA400OnTheListNotAnException(OrderListKind kind, string field, string message)
    {
        var harness = new Harness();
        harness.Unit.ThrowOnSave(new OrderListEntryDeletedException(kind));

        var result = await harness.Handler.HandleAsync(Valid(), OrderImportRules.Default, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("orders.invalid-request");
        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message]);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task ALockThatCannotBeHadInTimeIsThe409OrdersBusyAnswer()
    {
        var harness = new Harness();
        harness.Numbers.ReserveLegacyAsync(Arg.Any<string>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).ThrowsAsync(new OrderNumberBusyException());

        var result = await harness.Handler.HandleAsync(Valid(), OrderImportRules.Default, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.Busy);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ADeadlockVictimAtSaveIsTheSame409()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(Valid(), OrderImportRules.Default, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.Busy);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task AnOrderTheDomainRefusesTakesNoLockAndLooksUpNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid() with { Number = string.Empty }, OrderImportRules.Default, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["number"]);
        harness.Numbers.ReceivedCalls().ShouldBeEmpty();
        harness.Lists.ReceivedCalls().ShouldBeEmpty();
        harness.Staff.ReceivedCalls().ShouldBeEmpty();
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    private static IReadOnlyDictionary<string, string[]> Fields(Result<Guid> result)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("orders.invalid-request");
        return result.Error.FieldErrors.ShouldNotBeNull();
    }

    private static OrderDetails Details() =>
        new("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", null, null, Today.AddDays(-10), Today.AddDays(4), null);

    private static NewOrderItem Item(Guid productTypeId) =>
        new(productTypeId, "Jersey top", "S-XL", 15, 650.00m);

    private static NewOrderPayment Payment(Guid receivedBy) =>
        new(Today.AddDays(-3), 1000.00m, CashId, null, null, receivedBy);

    private static NewOrderRefund Refund(Guid refundedBy) =>
        new(Today.AddDays(-1), 100.00m, "Order changed", refundedBy);

    private static NewOrderExpense Expense(Guid paidBy) =>
        new(Today.AddDays(-2), 300.00m, FabricId, null, paidBy);

    private static OrderImportSnapshot Valid() =>
        new("ORD-2026-0148", Details(), OrderStatus.InProduction, [Item(ProductTypeId)])
        {
            Payments = [Payment(ActiveId)],
            Refunds = [Refund(ActiveId)],
            Expenses = [Expense(ActiveId)],
            StatusHistory = [new ImportedStatusChange(null, OrderStatus.InProduction, ActiveId, Now)],
        };

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }

    private sealed class Harness
    {
        public Harness()
        {
            Orders = Substitute.For<IOrders>();
            Orders.NumberTakenAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
            Numbers = Substitute.For<IOrderNumbers>();
            Lists = Substitute.For<IOrderLists>();
            Lists.GetStatesAsync(OrderListKind.ProductType, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(call => States(
                call.Arg<IReadOnlyCollection<Guid>>(),
                [ProductTypeId, OtherProductTypeId, RetiredProductTypeId],
                RetiredProductTypeId));
            Lists.GetStatesAsync(OrderListKind.PaymentMethod, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(call => States(
                call.Arg<IReadOnlyCollection<Guid>>(),
                [CashId, RetiredMethodId],
                RetiredMethodId));
            Lists.GetStatesAsync(OrderListKind.OrderExpenseCategory, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(call => States(
                call.Arg<IReadOnlyCollection<Guid>>(),
                [FabricId, RetiredCategoryId],
                RetiredCategoryId));
            Staff = Substitute.For<IStaffDirectory>();
            Staff.GetStaffStateAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                var id = call.Arg<Guid>();
                StaffState? state = id == ActiveId || id == OtherActiveId
                    ? new StaffState(id, "Mina Mercado", Roles.Manager, true, false, false, true)
                    : id == InactiveId ? new StaffState(id, "Dee Dizon", Roles.Admin, false, false, false, true) : null;
                return Task.FromResult(state);
            });
            Handler = new ImportOrderHandler(Orders, Numbers, Lists, Staff, new FixedCalendar(), Unit);
        }

        public IOrders Orders { get; }

        public IOrderNumbers Numbers { get; }

        public IOrderLists Lists { get; }

        public IStaffDirectory Staff { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public ImportOrderHandler Handler { get; }

        private static Task<IReadOnlyList<OrderListEntryState>> States(IReadOnlyCollection<Guid> asked, Guid[] known, Guid retired)
        {
            IReadOnlyList<OrderListEntryState> states = [.. asked.Where(known.Contains).Select(id => new OrderListEntryState(id, "Entry", id == retired))];
            return Task.FromResult(states);
        }
    }
}

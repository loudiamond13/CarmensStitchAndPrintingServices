using Csps.Application.Auth;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using FluentValidation;
using FluentValidation.Results;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace Csps.Application.UnitTests.Orders;

/// <summary>
/// ORD-03, ORD-13, ORD-14, D-18, D-23: the handler checks the form and the product types together and lists every failed field in
/// one 400, takes a number only after every check passed, and saves the order once inside one transaction.
/// </summary>
public sealed class CreateOrderHandlerTests
{
    // 2027-01-01 00:00 in the fixed UTC+8 zone, so the business year differs from the UTC year.
    private static readonly DateTimeOffset Now = new(2026, 12, 31, 16, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid ProductTypeId = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid OtherProductTypeId = Guid.Parse("01a17fce-7801-7e45-b875-357767854eda");

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Numbers.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnUnknownProductTypeIsRefusedOnTheItemPath()
    {
        var harness = new Harness();
        harness.Lists.GetStatesAsync(OrderListKind.ProductType, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<OrderListEntryState>>([]));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        OnlyField(result, "items[0].productTypeId", "Choose a product type.");
        harness.Orders.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ARetiredProductTypeIsRefusedWithTheRetiredMessage()
    {
        var harness = new Harness();
        harness.Lists.GetStatesAsync(OrderListKind.ProductType, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<OrderListEntryState>>([new OrderListEntryState(ProductTypeId, "Polo Shirt", Retired: true)]));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        OnlyField(result, "items[0].productTypeId", "This product type was retired. Choose another one.");
    }

    [Fact]
    public async Task EachItemIsCheckedOnItsOwnPathAndTheLookupAsksOnceForTheDistinctIds()
    {
        var harness = new Harness();
        harness.Lists.GetStatesAsync(OrderListKind.ProductType, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<OrderListEntryState>>([new OrderListEntryState(ProductTypeId, "Basketball Jersey", Retired: false)]));
        var request = Valid() with
        {
            Items = [Item(ProductTypeId), Item(OtherProductTypeId), Item(ProductTypeId), Item(OtherProductTypeId)],
        };

        var result = await harness.Handler.HandleAsync(request, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["items[1].productTypeId", "items[3].productTypeId"]);
        await harness.Lists.Received(1).GetStatesAsync(
            OrderListKind.ProductType,
            Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 2 && ids.Contains(ProductTypeId) && ids.Contains(OtherProductTypeId)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AStaticErrorAndAProductTypeErrorComeBackTogetherInOneBadRequest()
    {
        var harness = new Harness();
        harness.Lists.GetStatesAsync(OrderListKind.ProductType, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<OrderListEntryState>>([]));

        var result = await harness.Handler.HandleAsync(Valid() with { CustomerName = " ", Items = [Item(ProductTypeId) with { Quantity = 0 }] }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("orders.invalid-request");
        result.Error.Message.ShouldBe("Check the highlighted fields.");
        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["customerName", "items[0].productTypeId", "items[0].quantity"]);
        harness.Numbers.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AFormWithNoProductTypeIdsIsNotLookedUp()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(CreateOrderRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["contactNumber", "customerName", "dueDate", "items", "orderDate"]);
        await harness.Lists.DidNotReceiveWithAnyArgs().GetStatesAsync(default, default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ANullItemAndAnEmptyProductTypeAreNotLookedUp()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(
            Valid() with { Items = [null!, Item(Guid.Empty), Item(null)] },
            TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["items[0]", "items[1].productTypeId", "items[2].productTypeId"]);
        await harness.Lists.DidNotReceiveWithAnyArgs().GetStatesAsync(default, default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ADomainRefusalAfterTheFormPassedTakesNoNumberAndSavesNothing()
    {
        var harness = new Harness(validator: new PassingValidator());

        var result = await harness.Handler.HandleAsync(Valid() with { CustomerName = " " }, TestContext.Current.CancellationToken);

        OnlyField(result, "customerName", "Enter the customer's name.");
        harness.Numbers.ReceivedCalls().ShouldBeEmpty();
        harness.Orders.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Unit.Saves.ShouldBe(0);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task ABusyNumberLockIsA409AndTheTransactionRollsBack()
    {
        var harness = new Harness();
        harness.Numbers.NextAsync(Arg.Any<int>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).ThrowsAsync(new OrderNumberBusyException());

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.Busy);
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        result.Error.Code.ShouldBe("orders.busy");
        result.Error.Message.ShouldBe("Orders are being saved right now. Try again in a moment.");
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
        harness.Orders.DidNotReceiveWithAnyArgs().Add(default!);
        await harness.Reader.DidNotReceiveWithAnyArgs().GetDetailAsync(default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ASuccessTakesTheNumberOfTheBusinessYearAddsTheOrderOnceAndSavesOnceInOneTransaction()
    {
        var harness = new Harness();
        Order? added = null;
        harness.Orders.When(store => store.Add(Arg.Any<Order>())).Do(call => added = call.Arg<Order>());

        var result = await harness.Handler.HandleAsync(Valid() with { Status = "mockup", CustomerName = "  Juan  " }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Numbers.Received(1).NextAsync(2027, Now, Arg.Any<CancellationToken>());
        harness.Orders.Received(1).Add(Arg.Any<Order>());
        var order = added.ShouldNotBeNull();
        order.Number.ShouldBe("ORD-2027-0001");
        order.CustomerName.ShouldBe("Juan");
        order.Status.ShouldBe(OrderStatus.Mockup);
        order.StatusChanges.ShouldHaveSingleItem().ChangedById.ShouldBe(CallerId);
        order.Totals.Total.ShouldBe(9750.00m);
        order.CreatedById.ShouldBeNull();
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(order.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WithNoStatusTheOrderStartsPending()
    {
        var harness = new Harness();
        Order? added = null;
        harness.Orders.When(store => store.Add(Arg.Any<Order>())).Do(call => added = call.Arg<Order>());

        (await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();

        added.ShouldNotBeNull().Status.ShouldBe(OrderStatus.Pending);
    }

    [Fact]
    public async Task AnOrderTheReaderCannotFindAfterTheSaveIsA404()
    {
        var harness = new Harness();
        harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(null));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    [Fact]
    public async Task ASuccessRecordsOneCreatedEntryForTheOrderBeforeTheSave()
    {
        var harness = new Harness();
        Order? added = null;
        harness.Orders.When(store => store.Add(Arg.Any<Order>())).Do(call => added = call.Arg<Order>());

        var result = await harness.Handler.HandleAsync(
            Valid() with { CustomerName = "Private Customer", Notes = "Private note" },
            TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Call.ShouldBe(new AuditCall(
            AuditActions.OrderCreated,
            "Order",
            added.ShouldNotBeNull().Id.ToString("D"),
            "number=ORD-2027-0001;status=pending;orderDate=2026-12-31;dueDate=2027-01-14;items=1;total=9750.00",
            Independent: false));
        entry.SavesSoFar.ShouldBe(0);
        harness.Unit.Saves.ShouldBe(1);
        entry.Call.Detail.ShouldNotBeNull().ShouldNotContain("Private", Case.Insensitive);
    }

    [Fact]
    public async Task ARefusedFormRecordsNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Valid() with { CustomerName = " " }, TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ABusyNumberLockRecordsNothingBecauseNoEntryWasWrittenBeforeTheNumber()
    {
        var harness = new Harness();
        harness.Numbers.NextAsync(Arg.Any<int>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).ThrowsAsync(new OrderNumberBusyException());

        await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task GetReturnsTheOrderA404ForAMissingOneAndTheSessionErrorWithNoCaller()
    {
        var harness = new Harness();
        var id = Guid.NewGuid();

        var found = await harness.Get.HandleAsync(id, TestContext.Current.CancellationToken);
        harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(null));
        var missing = await harness.Get.HandleAsync(id, TestContext.Current.CancellationToken);
        var anonymous = await new Harness(noCaller: true).Get.HandleAsync(id, TestContext.Current.CancellationToken);

        found.IsSuccess.ShouldBeTrue();
        missing.Error.ShouldBe(OrderErrors.NotFound);
        missing.Error.Code.ShouldBe("orders.not-found");
        missing.Error.Message.ShouldBe("This order was not found or was deleted.");
        anonymous.Error.ShouldBe(AuthErrors.SessionEnded);
    }

    [Theory]
    [InlineData("pending", OrderStatus.Pending)]
    [InlineData("mockup", OrderStatus.Mockup)]
    [InlineData("production", OrderStatus.InProduction)]
    [InlineData("ready", OrderStatus.Ready)]
    [InlineData("delivered", OrderStatus.Delivered)]
    [InlineData("completed", OrderStatus.Completed)]
    [InlineData("cancelled", OrderStatus.Cancelled)]
    [InlineData(" Cancelled ", OrderStatus.Cancelled)]
    public void StatusKeysRoundTrip(string key, OrderStatus status)
    {
        OrderStatusNames.TryParse(key, out var parsed).ShouldBeTrue();

        parsed.ShouldBe(status);
        OrderStatusNames.ToKey(status).ShouldBe(key.Trim().ToLowerInvariant());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("done")]
    public void AnUnknownStatusKeyDoesNotParse(string? key) => OrderStatusNames.TryParse(key, out _).ShouldBeFalse();

    [Fact]
    public void AnUndefinedStatusNumberHasNoKey() =>
        Should.Throw<ArgumentOutOfRangeException>(() => OrderStatusNames.ToKey((OrderStatus)0));

    private static CreateOrderRequest Valid() => new(
        "Juan Dela Cruz",
        "Brgy. San Roque Ballers",
        "0917 123 4567",
        "juan.dc@example.com",
        null,
        "2026-12-31",
        "2027-01-14",
        null,
        null,
        [Item(ProductTypeId)]);

    private static OrderItemRequest Item(Guid? productTypeId) => new(productTypeId, "Jersey top", "S-XL", 15, 650.00m);

    private static void OnlyField(Result<OrderDetailResponse> result, string field, string message)
    {
        var fields = Fields(result);
        fields.Keys.ShouldBe([field]);
        fields[field].ShouldBe([message]);
    }

    private static IReadOnlyDictionary<string, string[]> Fields(Result<OrderDetailResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        return result.Error.FieldErrors.ShouldNotBeNull();
    }

    private sealed class PassingValidator : AbstractValidator<CreateOrderRequest>
    {
    }

    private sealed class Harness
    {
        public Harness(bool noCaller = false, IValidator<CreateOrderRequest>? validator = null)
        {
            Audit = new SaveAwareAudit(Unit);
            Orders = Substitute.For<IOrders>();
            Reader = Substitute.For<IOrderReader>();
            Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(Detail()));
            Numbers = Substitute.For<IOrderNumbers>();
            Numbers.NextAsync(Arg.Any<int>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(OrderNumber.Format(call.Arg<int>(), 1)));
            Lists = Substitute.For<IOrderLists>();
            Lists.GetStatesAsync(OrderListKind.ProductType, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IReadOnlyList<OrderListEntryState>>(
                [
                    new OrderListEntryState(ProductTypeId, "Basketball Jersey", Retired: false),
                    new OrderListEntryState(OtherProductTypeId, "Volleyball Jersey", Retired: false),
                ]));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new CreateOrderHandler(Orders, Reader, Numbers, Lists, new FixedCalendar(), Audit, Unit, request, validator ?? new CreateOrderRequestValidator());
            Get = new GetOrderHandler(Reader, request);
        }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public IOrderNumbers Numbers { get; }

        public IOrderLists Lists { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public SaveAwareAudit Audit { get; }

        public CreateOrderHandler Handler { get; }

        public GetOrderHandler Get { get; }

        private static OrderDetailResponse Detail() => new(
            Guid.NewGuid(),
            "ORD-2027-0001",
            "Juan Dela Cruz",
            null,
            "0917 123 4567",
            null,
            null,
            new DateOnly(2026, 12, 31),
            new DateOnly(2027, 1, 14),
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
            throw new NotSupportedException("The order audit entry must join the change's own save.");
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}

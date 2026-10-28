using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using FluentValidation;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-05, ORD-08, D-22, D-25, SEC-07: the handler checks the form, finds the order, compares the version and saves once; an unchanged form saves nothing.</summary>
public sealed class UpdateOrderDetailsHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 31, 164];
    private static readonly string StoredVersionText = Convert.ToBase64String(StoredVersion);

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AMalformedVersionIsA400OnVersionAndTheOrderIsNotLookedUp()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Version = "not a version" }, TestContext.Current.CancellationToken);

        Fields(result).Keys.ShouldBe(["version"]);
        Fields(result)["version"].ShouldBe(["Reload the form and try again."]);
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnEmptyFormListsEveryRequiredFieldIncludingTheVersion()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, UpdateOrderDetailsRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["contactNumber", "customerName", "dueDate", "orderDate", "version"]);
        result.Error.Code.ShouldBe("orders.invalid-request");
        harness.Orders.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnknownOrderIsA404AndNothingIsSaved()
    {
        var harness = new Harness(found: false);

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
        harness.Unit.Saves.ShouldBe(0);
        await harness.Reader.DidNotReceiveWithAnyArgs().GetDetailAsync(default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ADifferentVersionIsStaleAndNothingIsChangedOrSaved()
    {
        var harness = new Harness();
        var other = Convert.ToBase64String([0, 0, 0, 0, 0, 0, 31, 165]);

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Version = other, CustomerName = "Maria Santos" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        harness.Order.CustomerName.ShouldBe("Juan Dela Cruz");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ALostRaceAtSaveTimeIsStaleAndIsNotRetried()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { CustomerName = "Maria Santos" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
        await harness.Orders.Received(1).FindAsync(harness.Order.Id, false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AFormWithNoChangeIsA200ThatSavesNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(harness.Order.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ARealChangeSavesOnceInOneTransactionWithTheClockInstantAndReadsTheOrderBack()
    {
        var harness = new Harness();
        var editVersion = harness.Order.EditVersion;

        var result = await harness.Handler.HandleAsync(
            harness.Order.Id,
            Valid() with { CustomerName = "  Maria Santos ", DueDate = "2026-11-30" },
            TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Order.CustomerName.ShouldBe("Maria Santos");
        harness.Order.DueDate.ShouldBe(new DateOnly(2026, 11, 30));
        harness.Order.EditVersion.ShouldNotBe(editVersion);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Orders.Received(1).FindAsync(harness.Order.Id, false, Arg.Any<CancellationToken>());
        await harness.Reader.Received(1).GetDetailAsync(harness.Order.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnyStaffMemberMayEditWithNoOwnerCheck()
    {
        var harness = new Harness();
        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Notes = "Call first" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Order.Notes.ShouldBe("Call first");
    }

    [Fact]
    public async Task ADomainRefusalAfterTheFormPassedSavesNothing()
    {
        var harness = new Harness(validator: new PassingValidator());

        var result = await harness.Handler.HandleAsync(
            harness.Order.Id,
            Valid() with { CustomerName = " " },
            TestContext.Current.CancellationToken);

        Fields(result)["customerName"].ShouldBe(["Enter the customer's name."]);
        harness.Unit.Saves.ShouldBe(0);
        harness.Order.CustomerName.ShouldBe("Juan Dela Cruz");
    }

    [Fact]
    public async Task AnOrderTheReaderCannotFindAfterTheSaveIsA404()
    {
        var harness = new Harness();
        harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(null));

        var result = await harness.Handler.HandleAsync(harness.Order.Id, Valid() with { Notes = "x" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    [Fact]
    public async Task ANullRequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(harness.Order.Id, null!, TestContext.Current.CancellationToken));
    }

    private static UpdateOrderDetailsRequest Valid() => new(
        "Juan Dela Cruz",
        "Brgy. San Roque Ballers",
        "0917 123 4567",
        "juan.dc@example.com",
        null,
        "2026-10-28",
        "2026-11-11",
        null,
        StoredVersionText);

    private static IReadOnlyDictionary<string, string[]> Fields(Result<OrderDetailResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        return result.Error.FieldErrors.ShouldNotBeNull();
    }

    private sealed class PassingValidator : AbstractValidator<UpdateOrderDetailsRequest>
    {
    }

    private sealed class Harness
    {
        public Harness(bool noCaller = false, bool found = true, IValidator<UpdateOrderDetailsRequest>? validator = null)
        {
            var items = new[] { new NewOrderItem(Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6"), "Jersey top", "S-XL", 15, 650.00m) };
            var details = new OrderDetails("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", "juan.dc@example.com", null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null);
            Order = Order.Create(new NewOrder(details, OrderStatus.Pending, items), Guid.NewGuid(), Now).Value;
            typeof(Order).GetProperty(nameof(Order.RowVersion), BindingFlags.Instance | BindingFlags.Public)!.SetValue(Order, StoredVersion);
            Orders = Substitute.For<IOrders>();
            Orders.FindAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<Order?>(found ? Order : null));
            Reader = Substitute.For<IOrderReader>();
            Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(Detail()));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new UpdateOrderDetailsHandler(Orders, Reader, new FixedCalendar(), Unit, request, validator ?? new UpdateOrderDetailsRequestValidator());
        }

        public Order Order { get; }

        public IOrders Orders { get; }

        public IOrderReader Reader { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public UpdateOrderDetailsHandler Handler { get; }

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

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}

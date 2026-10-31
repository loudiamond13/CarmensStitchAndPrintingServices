using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Domain.Orders;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-01, ORD-02: the order list checks its query first, turns text into a typed query with the defaults, and maps stored rows to the wire.</summary>
public sealed class ListOrdersHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly Guid PoloId = Guid.Parse("447ad32e-1433-4b70-8786-72e3dc3f9937");

    [Fact]
    public async Task WithNoCallerTheSessionHasEndedAndTheReaderIsNeverCalled()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(new ListOrdersRequest(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await harness.Reader.DidNotReceive().ListAsync(Arg.Any<OrderListQuery>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ABadQueryIsA400NamingEachBadFieldAndTheReaderIsNeverCalled()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListOrdersRequest(Status: "shipped", Sort: "price", PageSize: 0), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("orders.invalid-request");
        result.Error.FieldErrors.ShouldNotBeNull().Keys.Select(static key => key.ToLowerInvariant()).Order(StringComparer.Ordinal).ShouldBe(["pagesize", "sort", "status"]);
        await harness.Reader.DidNotReceive().ListAsync(Arg.Any<OrderListQuery>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnEmptyRequestAsksTheReaderForTheActiveListByDueDateFirstPageOfTwentyWithTheClockNow()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListOrdersRequest(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Asked.ShouldBe(new OrderListQuery(null, OrderListScope.Active, null, null, null, null, false, OrderListSort.Due, 1, 20));
        harness.AskedAt.ShouldBe(Now);
    }

    [Fact]
    public async Task EveryPartIsTurnedIntoItsTypedForm()
    {
        var harness = new Harness();
        var request = new ListOrdersRequest(" Dela Cruz ", "Production", "2026-10-01", " 2026-10-31 ", PoloId.ToString("D"), true, "Balance", 3, 50);

        var result = await harness.Handler.HandleAsync(request, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Asked.ShouldBe(new OrderListQuery(
            "Dela Cruz",
            OrderListScope.One,
            OrderStatus.InProduction,
            new DateOnly(2026, 10, 1),
            new DateOnly(2026, 10, 31),
            PoloId,
            true,
            OrderListSort.Balance,
            3,
            50));
        result.Value.Page.ShouldBe(3);
        result.Value.PageSize.ShouldBe(50);
    }

    [Theory]
    [InlineData("all", OrderListScope.All)]
    [InlineData("ACTIVE", OrderListScope.Active)]
    [InlineData("  ", OrderListScope.Active)]
    public async Task AllAndActiveAreScopesAndABlankStatusIsActive(string status, OrderListScope scope)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListOrdersRequest(Status: status), TestContext.Current.CancellationToken);

        harness.Asked!.Scope.ShouldBe(scope);
        harness.Asked.Status.ShouldBeNull();
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public async Task OnlyAnExplicitTrueTurnsTheBalanceFilterOn(bool? hasBalance, bool expected)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListOrdersRequest(HasBalance: hasBalance), TestContext.Current.CancellationToken);

        harness.Asked!.HasBalance.ShouldBe(expected);
    }

    [Fact]
    public async Task ABlankSearchBlankDatesAndABlankProductTypeAreNoFilter()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListOrdersRequest(Q: "   ", From: " ", To: "", ProductType: " "), TestContext.Current.CancellationToken);

        harness.Asked.ShouldBe(new OrderListQuery(null, OrderListScope.Active, null, null, null, null, false, OrderListSort.Due, 1, 20));
    }

    [Fact]
    public async Task RowsAreMappedWithTheStatusKeyAndTheStoredFiguresAndCarryThePageAndTheTotal()
    {
        var harness = new Harness();
        var first = Row("ORD-2026-0148", OrderStatus.InProduction, new DateOnly(2026, 11, 11), 22450.00m, 1122.50m, 21327.50m, 12000.00m, 0.00m, 9327.50m, 0.00m, false);
        var second = Row("ORD-2026-0149", OrderStatus.Cancelled, null, 100.00m, 0.00m, 100.00m, 100.00m, 0.00m, 0.00m, 0.00m, true);
        harness.Reader.ListAsync(Arg.Any<OrderListQuery>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new OrderListPage([first, second], 12)));

        var result = await harness.Handler.HandleAsync(new ListOrdersRequest(Page: 2, PageSize: 5), TestContext.Current.CancellationToken);

        var page = result.Value;
        page.Total.ShouldBe(12);
        page.Page.ShouldBe(2);
        page.PageSize.ShouldBe(5);
        page.Items.Count.ShouldBe(2);
        page.Items[0].ShouldBe(new OrderListEntry(
            first.Id, "ORD-2026-0148", "Juan Dela Cruz", "Ballers", new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), "production", Now,
            22450.00m, 1122.50m, 21327.50m, 12000.00m, 0.00m, 9327.50m, 0.00m, false));
        page.Items[1].Status.ShouldBe("cancelled");
        page.Items[1].DueDate.ShouldBeNull();
        page.Items[1].FullyPaid.ShouldBeTrue();
    }

    [Fact]
    public void ADefaultRequestIsTheFirstPageOfTwentyAndANullRequestIsAProgrammingError()
    {
        var request = new ListOrdersRequest();

        request.Page.ShouldBe(1);
        request.PageSize.ShouldBe(20);
        Should.Throw<ArgumentNullException>(() => new Harness().Handler.HandleAsync(null!, TestContext.Current.CancellationToken));
    }

    [Fact]
    public void TheParseHelpersReadASortAProductTypeAndAStatus()
    {
        ListOrdersRequestValidator.TryParseSort("newest", out var sort).ShouldBeTrue();
        sort.ShouldBe(OrderListSort.Newest);
        ListOrdersRequestValidator.TryParseProductType(null, out var id).ShouldBeFalse();
        id.ShouldBe(Guid.Empty);
        ListOrdersRequestValidator.TryParseStatus("shipped", out var scope, out var status).ShouldBeFalse();
        scope.ShouldBe(OrderListScope.One);
        status.ShouldBeNull();
    }

    private static OrderListRow Row(
        string number,
        OrderStatus status,
        DateOnly? due,
        decimal subtotal,
        decimal discount,
        decimal total,
        decimal paid,
        decimal refunded,
        decimal balance,
        decimal credit,
        bool fullyPaid) =>
        new(Guid.NewGuid(), number, "Juan Dela Cruz", "Ballers", new DateOnly(2026, 10, 28), due, status, Now, subtotal, discount, total, paid, refunded, balance, credit, fullyPaid);

    private sealed class Harness
    {
        public Harness(bool noCaller = false)
        {
            Reader = Substitute.For<IOrderReader>();
            Reader.ListAsync(Arg.Any<OrderListQuery>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns(call =>
                {
                    Asked = call.Arg<OrderListQuery>();
                    AskedAt = call.Arg<DateTimeOffset>();
                    return Task.FromResult(new OrderListPage([], 0));
                });
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43"));
            Handler = new ListOrdersHandler(Reader, request, new FakeTimeProvider(Now), new ListOrdersRequestValidator());
        }

        public IOrderReader Reader { get; }

        public ListOrdersHandler Handler { get; }

        public OrderListQuery? Asked { get; private set; }

        public DateTimeOffset AskedAt { get; private set; }
    }
}

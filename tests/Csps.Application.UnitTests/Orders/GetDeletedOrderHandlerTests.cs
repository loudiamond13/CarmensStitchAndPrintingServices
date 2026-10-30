using Csps.Application.Auth;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.Users;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-06, D-24: a Manager reads a deleted order; a missing caller ends the session and a live or unknown order is a 404.</summary>
public sealed class GetDeletedOrderHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");

    [Fact]
    public async Task WithNoCallerTheSessionHasEndedAndTheReaderIsNotAsked()
    {
        var reader = Substitute.For<IOrderReader>();

        var result = await Handler(reader, noCaller: true).HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        reader.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AnOrderThatIsNotDeletedOrDoesNotExistIsThe404OrdersNotFound()
    {
        var reader = Substitute.For<IOrderReader>();
        reader.GetDeletedDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((DeletedOrderDetailResponse?)null);

        var result = await Handler(reader).HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(OrderErrors.NotFound);
    }

    [Fact]
    public async Task ADeletedOrderIsReturnedAsTheReaderGaveIt()
    {
        var id = Guid.NewGuid();
        var deleted = new DeletedOrderDetailResponse(Detail(id), Now, new ActorRef(CallerId, "Mina Mercado", false));
        var reader = Substitute.For<IOrderReader>();
        reader.GetDeletedDetailAsync(id, Arg.Any<CancellationToken>()).Returns(deleted);

        var result = await Handler(reader).HandleAsync(id, TestContext.Current.CancellationToken);

        result.Value.ShouldBeSameAs(deleted);
    }

    private static GetDeletedOrderHandler Handler(IOrderReader reader, bool noCaller = false)
    {
        var request = Substitute.For<IRequestContext>();
        request.UserId.Returns(noCaller ? null : CallerId);
        return new GetDeletedOrderHandler(reader, request);
    }

    private static OrderDetailResponse Detail(Guid id) => new(
        id,
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

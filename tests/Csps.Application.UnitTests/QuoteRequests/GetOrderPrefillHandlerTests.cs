using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Csps.Domain.Orders;
using Csps.Domain.QuoteRequests;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>INQ-06, D-20, Pitfall 7: the New Order form is prefilled from a request, with the product type picked from the chosen line.</summary>
public sealed class GetOrderPrefillHandlerTests
{
    private static readonly Guid Id = Guid.Parse("019aa1c2-7c40-7a11-8b3e-2f5d6c7e8a90");
    private static readonly Guid Bravo = Guid.Parse("4b2c6d81-0e5f-4a37-9c18-d2e7f3a5b690");
    private static readonly Guid Charlie = Guid.Parse("1f8e3a52-6c04-4d9b-b7a1-5e2d9c0f4b37");
    private static readonly Guid BravoTwin = Guid.Parse("0a7d5c13-9e26-4f48-8b5a-c3e1d7f2a964");

    // 23:30 on Nov 20 in UTC is already Nov 21 in Manila.
    private static readonly DateTimeOffset Received = new(2026, 11, 20, 23, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    [Fact]
    public async Task TheFormGetsTheDisplayPhoneTheMessageAsNotesTheBusinessDateAndTheFirstTypeOfTheLine()
    {
        var view = View(QuoteProductChoice.Line, [new QuoteLineProductType(Charlie, "Charlie Jersey"), new QuoteLineProductType(Bravo, "bravo Jersey")]);
        var handler = Build(view);

        var result = await handler.HandleAsync(Id, Token);

        var body = result.Value;
        body.QuoteRequestId.ShouldBe(Id);
        body.CustomerName.ShouldBe("Juan Dela Cruz");
        body.TeamName.ShouldBe("Brgy. San Roque Ballers");
        body.ContactNumber.ShouldBe("0917 123 4567");
        OrderRules.IsValidContactNumber(body.ContactNumber).ShouldBeTrue();
        body.Email.ShouldBe("juan@example.test");
        body.Notes.ShouldBe("Twelve jerseys, numbers 1 to 12.");
        body.ReceivedOn.ShouldBe(new DateOnly(2026, 11, 21));
        body.ProductTypeId.ShouldBe(Bravo);
    }

    [Fact]
    public async Task TwoTypesWithTheSameNameAreOrderedByTheirId()
    {
        var handler = Build(View(QuoteProductChoice.Line, [new QuoteLineProductType(Bravo, "Bravo Jersey"), new QuoteLineProductType(BravoTwin, "BRAVO JERSEY")]));

        var result = await handler.HandleAsync(Id, Token);

        result.Value.ProductTypeId.ShouldBe(BravoTwin);
    }

    [Theory]
    [InlineData(QuoteProductChoice.Custom)]
    [InlineData(QuoteProductChoice.NotSure)]
    [InlineData(null)]
    public async Task AnyOtherChoiceSuggestsNoType(QuoteProductChoice? choice)
    {
        var handler = Build(View(choice, [new QuoteLineProductType(Bravo, "Bravo Jersey")]));

        var result = await handler.HandleAsync(Id, Token);

        result.Value.ProductTypeId.ShouldBeNull();
    }

    [Fact]
    public async Task ALineWithNoActiveTypeSuggestsNone()
    {
        var handler = Build(View(QuoteProductChoice.Line, []));

        var result = await handler.HandleAsync(Id, Token);

        result.Value.ProductTypeId.ShouldBeNull();
    }

    [Fact]
    public async Task ANumberThatNoLongerParsesIsGivenAsStored()
    {
        var handler = Build(View(QuoteProductChoice.Custom, []) with { ContactNumberE164 = "+6391712" });

        var result = await handler.HandleAsync(Id, Token);

        result.Value.ContactNumber.ShouldBe("+6391712");
    }

    [Fact]
    public async Task AnUnknownIdIs404()
    {
        var handler = Build(null);

        var result = await handler.HandleAsync(Id, Token);

        result.Error.Code.ShouldBe("quote-requests.not-found");
    }

    [Fact]
    public async Task NoUsableAccountIs401AndNothingIsRead()
    {
        var reader = Substitute.For<IQuoteRequestReader>();
        var context = Substitute.For<IRequestContext>();
        context.UserId.Returns((Guid?)null);
        var handler = new GetOrderPrefillHandler(reader, new FixedCalendar(), context);

        var result = await handler.HandleAsync(Id, Token);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        reader.ReceivedCalls().ShouldBeEmpty();
    }

    private static QuoteOrderPrefillView View(QuoteProductChoice? choice, IReadOnlyList<QuoteLineProductType> types) => new(
        Id,
        Received,
        "Juan Dela Cruz",
        "Brgy. San Roque Ballers",
        "+639171234567",
        "juan@example.test",
        "Twelve jerseys, numbers 1 to 12.",
        choice,
        types);

    private static GetOrderPrefillHandler Build(QuoteOrderPrefillView? view)
    {
        var reader = Substitute.For<IQuoteRequestReader>();
        reader.GetOrderPrefillAsync(Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult(view));
        var context = Substitute.For<IRequestContext>();
        context.UserId.Returns(Guid.Parse("6a1f2e3d-4c5b-4a69-8778-9e0d1c2b3a45"));
        return new GetOrderPrefillHandler(reader, new FixedCalendar(), context);
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Received.AddDays(3)));
    }
}

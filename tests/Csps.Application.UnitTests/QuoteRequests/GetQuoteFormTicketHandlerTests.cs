using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Csps.Domain.QuoteRequests;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>INQ-03, OR-3: the ticket answer holds a ticket made at the business clock's time and the photo rules the form checks.</summary>
public sealed class GetQuoteFormTicketHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 10, 30, 0, TimeSpan.Zero);

    [Fact]
    public async Task TheTicketIsMadeAtTheClockTimeAndCarriesThePhotoRules()
    {
        var tickets = Substitute.For<IQuoteFormTickets>();
        tickets.Issue(Now).Returns("the-ticket");
        var handler = new GetQuoteFormTicketHandler(tickets, new FixedCalendar(), new ImageUploadSettings { MaxBytes = 5_000_000, MaxPixels = 12_000_000 });

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Ticket.ShouldBe("the-ticket");
        result.Value.PhotoRules.ShouldBe(new QuotePhotoRulesResponse(QuoteRequestRules.MaxPhotos, 5_000_000, 12_000_000));
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(TimeZoneInfo.Utc, ZoneSource.Stored, Now));
    }
}

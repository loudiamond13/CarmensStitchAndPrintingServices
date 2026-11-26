using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.QuoteRequests;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Use case: the quote form asks for its ticket when it opens (INQ-03). The ticket holds the time it was issued, so the server can tell
/// how long the form was open. The answer also carries the photo rules the form checks (OR-3), so they are never a second copy.
/// </summary>
/// <param name="tickets">The ticket maker.</param>
/// <param name="calendar">The business clock.</param>
/// <param name="photoLimits">The photo limits.</param>
/// <param name="settings">The quote form limits.</param>
public sealed class GetQuoteFormTicketHandler(IQuoteFormTickets tickets, IBusinessCalendar calendar, ImageUploadSettings photoLimits, QuoteRequestSettings settings)
{
    /// <summary>Makes a ticket.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The ticket and the photo rules.</returns>
    public async Task<Result<QuoteFormTicketResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(new QuoteFormTicketResponse(
            tickets.Issue(clock.UtcNow),
            new QuotePhotoRulesResponse(QuoteRequestRules.MaxPhotos, photoLimits.MaxBytes, photoLimits.MaxPixels),
            settings.MinimumSeconds));
    }
}

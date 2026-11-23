namespace Csps.Application.QuoteRequests;

/// <summary>The answer to a form ticket request: the ticket and the photo rules the form checks before sending (OR-3).</summary>
/// <param name="Ticket">The signed ticket the create call must carry.</param>
/// <param name="PhotoRules">The limits the form applies to photos.</param>
/// <param name="MinimumSeconds">How long the form waits after it gets the ticket before it sends (QuoteRequests:MinimumSeconds, D-41).</param>
public sealed record QuoteFormTicketResponse(string Ticket, QuotePhotoRulesResponse PhotoRules, int MinimumSeconds);

/// <summary>The photo limits the browser checks before it sends a file.</summary>
/// <param name="MaxPhotos">The most photos one request may have.</param>
/// <param name="MaxBytes">The largest file in bytes.</param>
/// <param name="MaxPixels">The most pixels (width times height) a photo may have.</param>
public sealed record QuotePhotoRulesResponse(int MaxPhotos, int MaxBytes, long MaxPixels);

namespace Csps.Application.QuoteRequests;

/// <summary>
/// The answer to a saved quote request. It names the request and the photo places the visitor declared, so each photo can be sent
/// to its own place, and nothing more. It holds no secret: the upload key is never sent back.
/// </summary>
/// <param name="Id">The id of the new request.</param>
/// <param name="PhotoSlots">One entry per declared photo, in slot order; empty when none were declared.</param>
public sealed record CreateQuoteRequestResponse(Guid Id, IReadOnlyList<QuotePhotoSlotResponse> PhotoSlots);

/// <summary>One declared photo place.</summary>
/// <param name="Slot">The place, from 0 to 4; the photo is sent to <c>/photos/{slot}</c>.</param>
/// <param name="FileName">The cleaned file name the visitor declared.</param>
public sealed record QuotePhotoSlotResponse(int Slot, string FileName);

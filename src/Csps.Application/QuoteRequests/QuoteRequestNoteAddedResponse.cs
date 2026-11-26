namespace Csps.Application.QuoteRequests;

/// <summary>
/// The answer to an added note (D-17). It holds no visitor details and no note text, because the idempotency gate keeps it for 24
/// hours where the purge and the delete cannot reach it. The page reads the request again for the notes.
/// </summary>
/// <param name="Id">The request id.</param>
/// <param name="NoteId">The new note's id.</param>
/// <param name="CreatedAtUtc">When the note was written.</param>
/// <param name="Version">The request's new row version to send with the next change.</param>
public sealed record QuoteRequestNoteAddedResponse(Guid Id, Guid NoteId, DateTimeOffset CreatedAtUtc, string Version);

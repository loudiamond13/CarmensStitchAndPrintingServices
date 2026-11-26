namespace Csps.Domain.QuoteRequests;

/// <summary>
/// One internal staff note on a quote request (D-17). Notes are add-only: nothing changes or removes a single note. A note leaves only
/// with its request (the purge or the Manager delete).
/// </summary>
public sealed class QuoteRequestNote
{
    // Used by EF Core (constructor binding) and by QuoteRequest.AddNote.
    internal QuoteRequestNote(Guid id, Guid quoteRequestId, string text, Guid createdById, DateTimeOffset createdAtUtc)
    {
        Id = id;
        QuoteRequestId = quoteRequestId;
        Text = text;
        CreatedById = createdById;
        CreatedAtUtc = createdAtUtc;
    }

    /// <summary>Gets the primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the request the note belongs to.</summary>
    public Guid QuoteRequestId { get; private set; }

    /// <summary>Gets the note, trimmed.</summary>
    public string Text { get; private set; }

    /// <summary>Gets who wrote the note.</summary>
    public Guid CreatedById { get; private set; }

    /// <summary>Gets when the note was written, in UTC.</summary>
    public DateTimeOffset CreatedAtUtc { get; private set; }
}

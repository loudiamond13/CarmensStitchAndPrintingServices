using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Use case: staff of either role add an internal note to a quote request (INQ-05, D-17). The body is checked first (400). Inside one
/// transaction the request is found (404), the domain adds the note, and one <c>quote-request.note-added</c> entry with the note id and
/// never its text joins the same save. No version is sent, because notes only append; the note moves the request's row version, so a
/// status change sent from before it is a 409. A lost race at the save is read again and decided again. Who wrote the note and when
/// come from the token and the clock (SEC-08). The answer is slim (no visitor details or note text), because the idempotency gate
/// stores it.
/// </summary>
public sealed class AddQuoteRequestNoteHandler(
    IQuoteRequestStore store,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    TimeProvider time,
    IValidator<AddQuoteRequestNoteRequest> validator)
{
    /// <summary>Adds the note.</summary>
    /// <param name="id">The request id.</param>
    /// <param name="request">The note.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The request id, the note id, when it was written and the new row version; a 400 on the text, a 401 when the token names no usable
    /// account, a 404 when there is no such request, or a 409 when two saves lost a race twice.
    /// </returns>
    public async Task<Result<QuoteRequestNoteAddedResponse>> HandleAsync(Guid id, AddQuoteRequestNoteRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<QuoteRequestNoteAddedResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<QuoteRequestNoteAddedResponse>(
                ValidationResults.ToError(validation, QuoteRequestErrors.ValidationCode, QuoteRequestErrors.ValidationMessage));
        }

        return await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, request.Text!, callerId, token), cancellationToken),
                Result.Failure<QuoteRequestNoteAddedResponse>(QuoteRequestErrors.Conflict))
            .ConfigureAwait(false);
    }

    private async Task<Result<QuoteRequestNoteAddedResponse>> AttemptAsync(Guid id, string text, Guid callerId, CancellationToken cancellationToken)
    {
        var quote = await store.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (quote is null)
        {
            return Result.Failure<QuoteRequestNoteAddedResponse>(QuoteRequestErrors.NotFound);
        }

        var added = quote.AddNote(text, callerId, time.GetUtcNow());
        if (added.IsFailure)
        {
            return Result.Failure<QuoteRequestNoteAddedResponse>(added.Error);
        }

        var note = added.Value;
        audit.Record(
            AuditActions.QuoteRequestNoteAdded,
            QuoteRequestAuditDetail.Target,
            AuditKey.Of(quote.Id),
            QuoteRequestAuditDetail.NoteAdded(note.Id));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        // The save reads back the new row version.
        return Result.Success(new QuoteRequestNoteAddedResponse(quote.Id, note.Id, note.CreatedAtUtc, RowVersions.ToText(quote.RowVersion)));
    }
}

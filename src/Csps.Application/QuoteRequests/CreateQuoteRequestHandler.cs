using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.QuoteRequests;
using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Use case: an anonymous visitor sends the "Get a Quote" form (INQ-01). The form is checked against the field rules, then a chosen
/// product line key is looked up among the shown lines (D-24): an unknown or hidden line is a 400 on <c>productLineKey</c>. The
/// request is built by the domain at status New, with the line's title kept as a snapshot, and saved in one transaction. A visitor
/// has no account, so the request has no creator, and its time comes from the clock (SEC-08). Nothing in the answer reveals more
/// than the new id and the photo places the visitor declared; the upload key is kept only as a hash.
/// </summary>
/// <param name="store">The quote request store.</param>
/// <param name="calendar">The business clock.</param>
/// <param name="unitOfWork">The unit of work.</param>
/// <param name="validator">The form rules.</param>
/// <param name="settings">The quote form limits.</param>
public sealed class CreateQuoteRequestHandler(
    IQuoteRequestStore store,
    IBusinessCalendar calendar,
    IUnitOfWork unitOfWork,
    IValidator<CreateQuoteRequestRequest> validator,
    QuoteRequestSettings settings)
{
    /// <summary>Saves the request.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new id, or a 400 listing every field that failed.</returns>
    public async Task<Result<CreateQuoteRequestResponse>> HandleAsync(CreateQuoteRequestRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<CreateQuoteRequestResponse>(ValidationResults.ToError(validation, QuoteRequestErrors.ValidationCode, QuoteRequestErrors.ValidationMessage));
        }

        // The validator has passed, so a present choice or quantity parses.
        _ = QuoteProductChoiceNames.TryParse(request.ProductChoice, out var choice);
        var hasChoice = !string.IsNullOrWhiteSpace(request.ProductChoice);
        QuoteProductLine? line = null;
        if (hasChoice && choice == QuoteProductChoice.Line)
        {
            line = await store.FindShownLineAsync(request.ProductLineKey!.Trim(), cancellationToken).ConfigureAwait(false);
            if (line is null)
            {
                return QuoteRequestRules.Reject<CreateQuoteRequestResponse>(QuoteRequestRules.ProductLineKeyField, QuoteRequestRules.ProductInvalid);
            }
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var received = QuoteRequest.Receive(Guid.CreateVersion7(clock.UtcNow), ToInput(request, hasChoice ? choice : null, line), clock.UtcNow);
        if (received.IsFailure)
        {
            return Result.Failure<CreateQuoteRequestResponse>(received.Error);
        }

        var saved = received.Value;
        if (request.Photos is { Count: > 0 })
        {
            // The validator has passed, so the key is a key. Only its hash is kept (CWE-639).
            _ = QuoteUploadKey.TryHash(request.UploadKey, out var keyHash);
            var declared = saved.DeclarePhotos(request.Photos, keyHash, clock.UtcNow + settings.UploadKeyLifetime);
            if (declared.IsFailure)
            {
                return Result.Failure<CreateQuoteRequestResponse>(declared.Error);
            }
        }

        await unitOfWork.InTransactionAsync(
            async token =>
            {
                store.Add(saved);
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return saved.Id;
            },
            cancellationToken).ConfigureAwait(false);
        return Result.Success(new CreateQuoteRequestResponse(saved.Id, [.. saved.Photos.Select(static photo => new QuotePhotoSlotResponse(photo.Slot, photo.FileName))]));
    }

    private static QuoteRequestInput ToInput(CreateQuoteRequestRequest request, QuoteProductChoice? choice, QuoteProductLine? line) =>
        new(
            request.CustomerName!,
            request.TeamName,
            request.ContactNumber!,
            request.Email,
            choice,
            line?.Id,
            line?.Title,
            QuoteQuantityRangeNames.TryParse(request.Quantity, out var range) ? range : null,
            request.Message);
}

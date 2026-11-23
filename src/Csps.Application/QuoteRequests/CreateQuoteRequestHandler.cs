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
/// <param name="tickets">The form ticket reader.</param>
/// <param name="botLog">The log of caught sends.</param>
public sealed class CreateQuoteRequestHandler(
    IQuoteRequestStore store,
    IBusinessCalendar calendar,
    IUnitOfWork unitOfWork,
    IValidator<CreateQuoteRequestRequest> validator,
    QuoteRequestSettings settings,
    IQuoteFormTickets tickets,
    IQuoteBotCatchLog botLog)
{
    /// <summary>
    /// Saves the request. The form ticket and the hidden field are judged first (INQ-03): no good ticket is a 400 so a real visitor
    /// sends again; a filled hidden field or a ticket younger than the minimum time gets the answer of a saved request and nothing is
    /// saved (D-25).
    /// </summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new id, or a 400 listing every field that failed or naming the ticket.</returns>
    public async Task<Result<CreateQuoteRequestResponse>> HandleAsync(CreateQuoteRequestRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var ticket = tickets.Read(request.Ticket, clock.UtcNow);
        if (!ticket.IsValid)
        {
            return Result.Failure<CreateQuoteRequestResponse>(QuoteRequestErrors.TicketExpired);
        }

        if (!string.IsNullOrWhiteSpace(request.SubjectLine))
        {
            return Caught(QuoteBotCatchReasons.Honeypot, request, clock.UtcNow);
        }

        if (ticket.Age < TimeSpan.FromSeconds(settings.MinimumSeconds))
        {
            return Caught(QuoteBotCatchReasons.TooFast, request, clock.UtcNow);
        }

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

        // The count and the insert run under one lock, so two sends at once from one sender never pass the limit (D-37, CWE-362).
        var wait = await unitOfWork.InTransactionAsync(
            async token =>
            {
                await store.LockAsync(token).ConfigureAwait(false);
                var recent = await store.CountRecentFromSenderAsync(saved.ContactNumberE164, saved.Email, clock.UtcNow - QuoteRequestSettings.SenderWindow, token).ConfigureAwait(false);
                if (recent.Count >= settings.PerSenderPerDay)
                {
                    // The sender may send again once enough of the counted requests have left the window.
                    return (TimeSpan?)(recent.Times[recent.Count - settings.PerSenderPerDay] + QuoteRequestSettings.SenderWindow - clock.UtcNow);
                }

                store.Add(saved);
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return null;
            },
            cancellationToken).ConfigureAwait(false);
        if (wait is { } retryAfter)
        {
            return Result.Failure<CreateQuoteRequestResponse>(QuoteRequestErrors.SenderLimit(retryAfter));
        }

        return Result.Success(new CreateQuoteRequestResponse(saved.Id, [.. saved.Photos.Select(static photo => new QuotePhotoSlotResponse(photo.Slot, photo.FileName))]));
    }

    // The answer of a saved request with a made-up id, so a bot learns nothing. Nothing is stored; one log line holds the reason code only.
    private Result<CreateQuoteRequestResponse> Caught(string reason, CreateQuoteRequestRequest request, DateTimeOffset now)
    {
        botLog.Caught(reason);
        var slots = (request.Photos ?? [])
            .Take(QuoteRequestRules.MaxPhotos)
            .Select(static (name, slot) => new QuotePhotoSlotResponse(slot, QuoteRequestRules.CleanPhotoName(name ?? string.Empty, slot)))
            .ToList();
        return Result.Success(new CreateQuoteRequestResponse(Guid.CreateVersion7(now), slots));
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

using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.QuoteRequests;
using Csps.Domain.Time;
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
/// <param name="siteContent">The site content store, for the Quote alerts address.</param>
/// <param name="outbox">The email outbox, for the staff alert.</param>
public sealed class CreateQuoteRequestHandler(
    IQuoteRequestStore store,
    IBusinessCalendar calendar,
    IUnitOfWork unitOfWork,
    IValidator<CreateQuoteRequestRequest> validator,
    QuoteRequestSettings settings,
    IQuoteFormTickets tickets,
    IQuoteBotCatchLog botLog,
    ISiteContentStore siteContent,
    IEmailOutbox outbox)
{
    /// <summary>
    /// Saves the request. The form ticket and the hidden field are judged first (INQ-03): no good ticket is a 400 that carries a replacement ticket so a real visitor
    /// sends again; a filled hidden field or a ticket younger than the minimum time gets the answer of a saved request and nothing is
    /// saved (D-25).
    /// </summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new id, a 400 listing every field that failed or naming the ticket, a 429 for a sender over the limit, or the 409 busy answer when the lock was not had in time.</returns>
    public async Task<Result<CreateQuoteRequestResponse>> HandleAsync(CreateQuoteRequestRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var ticket = tickets.Read(request.Ticket, clock.UtcNow);
        if (!ticket.IsValid)
        {
            // The replacement is already as old as the minimum time, so the visitor's one resend is not taken for a bot (D-38).
            var replacement = tickets.Issue(clock.UtcNow - TimeSpan.FromSeconds(settings.MinimumSeconds));
            return Result.Failure<CreateQuoteRequestResponse>(QuoteRequestErrors.TicketExpired(replacement, settings.MinimumSeconds));
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
        // A lost race is run once more; a lock not had in time, or a second lost race, is the shared busy answer.
        try
        {
            return await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => SaveUnderLockAsync(saved, clock, token), cancellationToken),
                    Result.Failure<CreateQuoteRequestResponse>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
        }
        catch (QuoteRequestsBusyException)
        {
            return Result.Failure<CreateQuoteRequestResponse>(AuthErrors.SessionBusy);
        }
    }

    private async Task<Result<CreateQuoteRequestResponse>> SaveUnderLockAsync(QuoteRequest saved, BusinessClock clock, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        await store.LockAsync(cancellationToken).ConfigureAwait(false);
        var recent = await store.CountRecentFromSenderAsync(saved.ContactNumberE164, saved.Email, now - QuoteRequestSettings.SenderWindow, cancellationToken).ConfigureAwait(false);
        if (recent.Count >= settings.PerSenderPerDay)
        {
            // The sender may send again once enough of the counted requests have left the window.
            var wait = recent.Times[recent.Count - settings.PerSenderPerDay] + QuoteRequestSettings.SenderWindow - now;
            return Result.Failure<CreateQuoteRequestResponse>(QuoteRequestErrors.SenderLimit(wait));
        }

        store.Add(saved);
        await QueueAlertAsync(saved, HourStart(clock), cancellationToken).ConfigureAwait(false);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(new CreateQuoteRequestResponse(saved.Id, [.. saved.Photos.Select(static photo => new QuotePhotoSlotResponse(photo.Slot, photo.FileName))]));
    }

    // The start of the current business hour, as an instant.
    private static DateTimeOffset HourStart(BusinessClock clock)
    {
        var local = TimeZoneInfo.ConvertTime(clock.UtcNow, clock.Zone);
        return (local - TimeSpan.FromTicks(local.Ticks % TimeSpan.TicksPerHour)).ToUniversalTime();
    }

    // The staff alert joins the request's own save, so it exists only when the request does (INQ-04). No address means no alert (D-07).
    // The count runs under the quote-requests lock and the rows of earlier sends are committed, so a busy hour never passes the limit (D-09).
    private async Task QueueAlertAsync(QuoteRequest saved, DateTimeOffset hourStart, CancellationToken cancellationToken)
    {
        var address = (await siteContent.GetQuoteAlertsEmailAsync(cancellationToken).ConfigureAwait(false)).Trim();
        if (address.Length == 0)
        {
            return;
        }

        var sent = await outbox.CountRecentAsync(AuthEmailKind.QuoteAlert, address, hourStart, cancellationToken).ConfigureAwait(false);
        if (sent >= settings.AlertsPerHour)
        {
            var overflowSent = await outbox.CountRecentAsync(AuthEmailKind.QuoteAlertsOverflow, address, hourStart, cancellationToken).ConfigureAwait(false);
            if (overflowSent == 0)
            {
                await EnqueueQuietlyAsync(new QuoteAlertsOverflowEmail(address), cancellationToken).ConfigureAwait(false);
            }

            return;
        }

        var email = new QuoteAlertEmail(
            address,
            saved.Id,
            saved.CustomerName,
            saved.TeamName,
            PhilippinePhone.TryParse(saved.ContactNumberE164, out var phone) ? phone.Display : saved.ContactNumberE164,
            ProductLabel(saved),
            saved.QuantityRange is { } range ? QuantityLabel(range) : null,
            saved.Photos.Count,
            saved.Message);
        await EnqueueQuietlyAsync(email, cancellationToken).ConfigureAwait(false);
    }

    private async Task EnqueueQuietlyAsync(AuthEmail email, CancellationToken cancellationToken)
    {
        try
        {
            await outbox.EnqueueAsync(email, cancellationToken).ConfigureAwait(false);
        }
        catch (ArgumentException)
        {
            // An address that can never receive mail must not cost the shop a lead; the request is still saved.
        }
    }

    private static string? ProductLabel(QuoteRequest saved) => saved.ProductChoice switch
    {
        QuoteProductChoice.Line => saved.ProductTitle,
        QuoteProductChoice.Custom => "Custom design",
        QuoteProductChoice.NotSure => "Not sure yet",
        _ => null,
    };

    private static string QuantityLabel(QuoteQuantityRange range) => range switch
    {
        QuoteQuantityRange.OneToNine => "1-9 pcs",
        QuoteQuantityRange.TenToTwenty => "10-20 pcs",
        QuoteQuantityRange.TwentyOneToFifty => "21-50 pcs",
        QuoteQuantityRange.FiftyOneToHundred => "51-100 pcs",
        _ => "100+ pcs",
    };

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

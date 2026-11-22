using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.QuoteRequests;
using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Use case: an anonymous visitor sends the "Get a Quote" form (INQ-01). The form is checked against the field rules, then the
/// request is built by the domain at status New and saved in one transaction. A visitor has no account, so the request has no
/// creator, and its time comes from the clock (SEC-08). Nothing in the answer reveals more than the new id.
/// </summary>
/// <param name="store">The quote request store.</param>
/// <param name="calendar">The business clock.</param>
/// <param name="unitOfWork">The unit of work.</param>
/// <param name="validator">The form rules.</param>
public sealed class CreateQuoteRequestHandler(
    IQuoteRequestStore store,
    IBusinessCalendar calendar,
    IUnitOfWork unitOfWork,
    IValidator<CreateQuoteRequestRequest> validator)
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

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var received = QuoteRequest.Receive(Guid.CreateVersion7(clock.UtcNow), ToInput(request), clock.UtcNow);
        if (received.IsFailure)
        {
            return Result.Failure<CreateQuoteRequestResponse>(received.Error);
        }

        var saved = received.Value;
        await unitOfWork.InTransactionAsync(
            async token =>
            {
                store.Add(saved);
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return saved.Id;
            },
            cancellationToken).ConfigureAwait(false);
        return Result.Success(new CreateQuoteRequestResponse(saved.Id));
    }

    // The validator has passed, so the name and the number are present.
    private static QuoteRequestInput ToInput(CreateQuoteRequestRequest request) =>
        new(request.CustomerName!, null, request.ContactNumber!, null);
}

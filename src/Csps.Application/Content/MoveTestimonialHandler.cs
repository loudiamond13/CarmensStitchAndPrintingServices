using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager moves a testimonial one place up or down in the display order (CONT-03). The testimonial trades places with the
/// one next to it in the Manager's list, hidden ones included, in one transaction under the site-content lock, so two Managers moving at
/// once end with every place used once. A move at the end of the order succeeds and changes and records nothing. A change writes one
/// <c>testimonial.moved</c> entry with the name and the old and new place. No version is sent: the move applies to the latest order, so a lost race is read again and decided again.
/// </summary>
/// <param name="testimonials">The testimonial store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="validator">The form rules.</param>
public sealed class MoveTestimonialHandler(
    ITestimonials testimonials,
    ISiteContentLock siteLock,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<MoveTestimonialRequest> validator)
{
    /// <summary>Moves the testimonial.</summary>
    /// <param name="id">The testimonial to move.</param>
    /// <param name="request">The direction.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 400 for a direction that is not up or down, a 404 when the testimonial does not exist, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, MoveTestimonialRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure(SiteContentErrors.Invalid(validation));
        }

        var up = string.Equals(request.Direction, MoveProductLineRequestValidator.Up, StringComparison.OrdinalIgnoreCase);
        try
        {
            var outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, up, token), cancellationToken),
                    Result.Failure<bool>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
            return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure(AuthErrors.SessionBusy);
        }
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, bool up, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var testimonial = await testimonials.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (testimonial is null)
        {
            return Result.Failure<bool>(SiteContentErrors.TestimonialNotFound);
        }

        var neighbour = await testimonials.FindNeighbourAsync(testimonial, up, cancellationToken).ConfigureAwait(false);
        if (neighbour is null)
        {
            return Result.Success(false);
        }

        var oldPosition = testimonial.Position;
        testimonial.SwapPositionWith(neighbour);
        audit.Record(AuditActions.TestimonialMoved, TestimonialAuditDetail.TargetType, AuditKey.Of(testimonial.Id), TestimonialAuditDetail.Moved(testimonial, oldPosition));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

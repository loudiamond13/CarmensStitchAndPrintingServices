using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager adds a testimonial (CONT-03, D-05). The form is checked first (400), then one transaction takes the site-content
/// lock, puts the testimonial at the end of the order, hidden unless the Manager ticked Show on the website, and saves it with a
/// <c>testimonial.added</c> entry that names the person and never the words. The lock makes
/// two Managers adding at once end with different places in the order. Who added it and when come from the token and the clock (SEC-08).
/// A save that loses a deadlock is read again once and is a 409 if it loses again.
/// </summary>
/// <param name="testimonials">The testimonial store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="time">The clock.</param>
/// <param name="validator">The form rules.</param>
public sealed class CreateTestimonialHandler(
    ITestimonials testimonials,
    ISiteContentLock siteLock,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time,
    IValidator<TestimonialRequest> validator)
{
    /// <summary>Adds the testimonial.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new testimonial, a 400 naming every field that failed, or a 409 when the save lost a race.</returns>
    public async Task<Result<TestimonialDto>> HandleAsync(TestimonialRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<TestimonialDto>(SiteContentErrors.Invalid(validation));
        }

        try
        {
            return await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(request, token), cancellationToken),
                    Result.Failure<TestimonialDto>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure<TestimonialDto>(AuthErrors.SessionBusy);
        }
    }

    private async Task<Result<TestimonialDto>> AttemptAsync(TestimonialRequest request, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var position = await testimonials.GetNextPositionAsync(cancellationToken).ConfigureAwait(false);
        var created = Testimonial.Create(request.ToValues(), position, time.GetUtcNow());
        if (created.IsFailure)
        {
            return Result.Failure<TestimonialDto>(created.Error);
        }

        testimonials.Add(created.Value);
        audit.Record(AuditActions.TestimonialAdded, TestimonialAuditDetail.TargetType, AuditKey.Of(created.Value.Id), TestimonialAuditDetail.Named(created.Value));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(TestimonialDto.From(created.Value));
    }
}

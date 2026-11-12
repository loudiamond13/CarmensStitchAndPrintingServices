using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager deletes a testimonial for good (CONT-03). A testimonial that is gone is a 404. One transaction writes the
/// <c>testimonial.deleted</c> entry with the name and removes the row. No version is sent: the delete
/// applies to the latest state, so a lost race is read again and decided again.
/// </summary>
/// <param name="testimonials">The testimonial store.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
public sealed class DeleteTestimonialHandler(ITestimonials testimonials, IAuditTrail audit, IUnitOfWork unitOfWork)
{
    /// <summary>Deletes the testimonial.</summary>
    /// <param name="id">The testimonial to delete.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 404 when the testimonial does not exist, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, CancellationToken cancellationToken)
    {
        var testimonial = await testimonials.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (testimonial is null)
        {
            return Result.Failure<bool>(SiteContentErrors.TestimonialNotFound);
        }

        audit.Record(AuditActions.TestimonialDeleted, TestimonialAuditDetail.TargetType, AuditKey.Of(testimonial.Id), TestimonialAuditDetail.Named(testimonial));
        testimonials.Remove(testimonial);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

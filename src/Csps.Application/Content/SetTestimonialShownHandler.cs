using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager hides a testimonial or shows it again (CONT-03, D-05, PUB-03). Hiding or showing a testimonial that is already so
/// succeeds and changes nothing. No version is sent: the change applies to the latest state, so a lost race is read again and decided
/// again.
/// </summary>
/// <param name="testimonials">The testimonial store.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
public sealed class SetTestimonialShownHandler(ITestimonials testimonials, IUnitOfWork unitOfWork)
{
    /// <summary>Shows or hides the testimonial.</summary>
    /// <param name="id">The testimonial.</param>
    /// <param name="shown">True to show it, false to hide it.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success (also when it was already so), a 404 when it does not exist, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, bool shown, CancellationToken cancellationToken)
    {
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, shown, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, bool shown, CancellationToken cancellationToken)
    {
        var testimonial = await testimonials.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (testimonial is null)
        {
            return Result.Failure<bool>(SiteContentErrors.TestimonialNotFound);
        }

        if (!(shown ? testimonial.Show() : testimonial.Hide()))
        {
            return Result.Success(false);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

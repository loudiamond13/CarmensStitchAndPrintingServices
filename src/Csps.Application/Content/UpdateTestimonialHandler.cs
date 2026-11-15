using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager edits a testimonial with the version the form was opened with (CONT-03, SEC-07). The steps run in this order and
/// stop at the first failure: the form is checked (400), then in one transaction the testimonial is found (404), the version is the
/// stored one (409) and the values are checked against the domain rules (400). A form save never retries on a conflict. A form with no
/// change saves nothing, writes no audit entry and keeps the version. A change writes <c>testimonial.changed</c> (the changed fields,
/// never the quote or the team line), and a flip of the shown flag writes <c>testimonial.shown</c> or <c>testimonial.hidden</c>, in the
/// same save.
/// </summary>
/// <param name="testimonials">The testimonial store.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="validator">The form rules.</param>
public sealed class UpdateTestimonialHandler(ITestimonials testimonials, IAuditTrail audit, IUnitOfWork unitOfWork, IValidator<TestimonialRequest> validator)
{
    /// <summary>Saves the edit.</summary>
    /// <param name="id">The testimonial to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The testimonial as saved, a 400 naming every field that failed, a 404 when it does not exist, or a 409 for a stale version.</returns>
    public async Task<Result<TestimonialDto>> HandleAsync(Guid id, TestimonialRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var context = new ValidationContext<TestimonialRequest>(request);
        context.RootContextData[TestimonialRequestValidator.EditKey] = true;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<TestimonialDto>(SiteContentErrors.Invalid(validation));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        try
        {
            return await unitOfWork.InTransactionAsync(token => AttemptAsync(id, version, request, token), cancellationToken).ConfigureAwait(false);
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<TestimonialDto>(EditErrors.Stale);
        }
    }

    private async Task<Result<TestimonialDto>> AttemptAsync(Guid id, byte[] version, TestimonialRequest request, CancellationToken cancellationToken)
    {
        var testimonial = await testimonials.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (testimonial is null)
        {
            return Result.Failure<TestimonialDto>(SiteContentErrors.TestimonialNotFound);
        }

        if (!testimonial.RowVersion.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<TestimonialDto>(EditErrors.Stale);
        }

        var changed = testimonial.Update(request.ToValues());
        if (changed.IsFailure)
        {
            return Result.Failure<TestimonialDto>(changed.Error);
        }

        var change = changed.Value;
        if (change.HasChange)
        {
            var key = AuditKey.Of(testimonial.Id);
            if (change.Fields.Count > 0)
            {
                audit.Record(AuditActions.TestimonialChanged, TestimonialAuditDetail.TargetType, key, TestimonialAuditDetail.Changed(change));
            }

            if (change.NowShown is { } shown)
            {
                audit.Record(shown ? AuditActions.TestimonialShown : AuditActions.TestimonialHidden, TestimonialAuditDetail.TargetType, key, TestimonialAuditDetail.Named(testimonial));
            }

            await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return Result.Success(TestimonialDto.From(testimonial));
    }
}

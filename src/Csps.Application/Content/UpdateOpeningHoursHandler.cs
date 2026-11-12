using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager saves the weekly hours with the version the form was opened with (CONT-01, SEC-07). The steps run in this order
/// and stop at the first failure: the form is checked (400), the week version is the stored one (409), then the seven days are set (400
/// again if a day breaks a domain rule). A form save never retries on a conflict. The hours have their own version, so a Business Info
/// save never makes it stale. A save with no change writes nothing and keeps the version; a change writes one
/// <c>opening-hours.changed</c> entry in the same save. The public cache is cleared after the commit by the data layer, so the next
/// public read shows the change (PUB-03). Who changed it and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="store">The site content store.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="validator">The form rules.</param>
public sealed class UpdateOpeningHoursHandler(
    ISiteContentStore store,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<UpdateOpeningHoursRequest> validator)
{
    private const string TargetType = "OpeningHours";
    private const string TargetId = "week";

    /// <summary>Saves the form.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The hours as saved, a 400 naming every day that failed, or a 409 for a stale version or a lost race.</returns>
    public async Task<Result<OpeningHoursDto>> HandleAsync(UpdateOpeningHoursRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OpeningHoursDto>(SiteContentErrors.Invalid(validation));
        }

        _ = OpeningHoursVersion.TryParse(request.Version, out var version);
        try
        {
            var outcome = await unitOfWork.InTransactionAsync(token => AttemptAsync(request.Days ?? [], version, token), cancellationToken).ConfigureAwait(false);
            if (outcome.IsFailure)
            {
                return Result.Failure<OpeningHoursDto>(outcome.Error);
            }
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<OpeningHoursDto>(EditErrors.Stale);
        }

        var view = await store.GetHoursViewAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(OpeningHoursDto.From(view));
    }

    private async Task<Result<bool>> AttemptAsync(IReadOnlyList<DayHoursDto> days, byte[] version, CancellationToken cancellationToken)
    {
        var rows = (await store.GetHoursForUpdateAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(row => row.DayOfWeek);
        var stored = rows.OrderBy(pair => pair.Key).SelectMany(pair => pair.Value.RowVersion).ToArray();
        if (!stored.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<bool>(EditErrors.Stale);
        }

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var changes = new List<OpeningHoursChange>();
        for (var index = 0; index < days.Count; index++)
        {
            var day = days[index].ToDomain();
            var result = rows[days[index].Day].SetHours(day.OpensAt, day.ClosesAt);
            if (result.IsFailure)
            {
                foreach (var (field, messages) in result.Error.FieldErrors!)
                {
                    errors[$"days[{index}].{field}"] = messages;
                }
            }
            else if (result.Value is { } change)
            {
                changes.Add(change);
            }
        }

        if (errors.Count > 0)
        {
            return Result.Failure<bool>(Error.Validation(SiteContentErrors.InvalidCode, SiteSettings.InvalidMessage, errors));
        }

        if (changes.Count == 0)
        {
            return Result.Success(false);
        }

        audit.Record(AuditActions.OpeningHoursChanged, TargetType, TargetId, OpeningHoursAuditDetail.Changed(changes));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}

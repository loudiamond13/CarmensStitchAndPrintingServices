using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager saves the business info (CONT-01). The form is checked first (400), then the settings are changed and the
/// phone list replaced in one transaction. The public cache is cleared after the commit by the data layer, so the next public read
/// shows the change (PUB-03). Who changed it and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="store">The business info store.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="validator">The form rules.</param>
/// <param name="time">The clock.</param>
public sealed class UpdateSiteSettingsHandler(
    ISiteContentStore store,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<UpdateSiteSettingsRequest> validator,
    TimeProvider time)
{
    /// <summary>Saves the form.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The settings as saved, or a 400 naming every field that failed.</returns>
    public async Task<Result<SiteSettingsDto>> HandleAsync(UpdateSiteSettingsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<SiteSettingsDto>(SiteContentErrors.Invalid(validation));
        }

        var outcome = await unitOfWork.InTransactionAsync(token => AttemptAsync(request, token), cancellationToken).ConfigureAwait(false);
        if (outcome.IsFailure)
        {
            return Result.Failure<SiteSettingsDto>(outcome.Error);
        }

        var view = await store.GetViewAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(SiteSettingsDto.From(view));
    }

    private async Task<Result<bool>> AttemptAsync(UpdateSiteSettingsRequest request, CancellationToken cancellationToken)
    {
        var current = await store.GetSettingsForUpdateAsync(cancellationToken).ConfigureAwait(false);
        var now = time.GetUtcNow();
        var changes = current.Settings.UpdateBusinessInfo(ToBusinessInfo(request), now);
        if (changes.IsFailure)
        {
            return Result.Failure<bool>(changes.Error);
        }

        store.ReplacePhones(current.Phones, changes.Value.Phones);
        audit.Record(AuditActions.SiteSettingsChanged, "SiteSettings", "1", null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }

    private static BusinessInfo ToBusinessInfo(UpdateSiteSettingsRequest request) => new(
        request.BusinessName ?? string.Empty,
        request.Tagline ?? string.Empty,
        request.AboutText,
        request.TurnaroundLine,
        request.Street,
        request.TownOrCity,
        request.Province,
        request.PostalCode,
        request.DirectionsUrl,
        request.MapEmbedUrl,
        request.MessengerUrl,
        request.FacebookUrl,
        request.InstagramUrl,
        request.TiktokUrl,
        request.ContactEmail,
        [.. (request.Phones ?? []).Select(static phone => new BusinessPhone(phone.Number ?? string.Empty, phone.Label, phone.IsMain))]);
}

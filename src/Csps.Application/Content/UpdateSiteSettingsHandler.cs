using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager saves the business info with the version the form was opened with (CONT-01, SEC-07). The steps run in this
/// order and stop at the first failure: the form is checked (400), the version is the stored one (409), then the values are stored
/// (400 again if a column rule fails). A form save never retries on a conflict: the person reloads and decides. A form with no change
/// saves nothing, writes no audit entry and keeps the version. A change writes one <c>site-settings.changed</c> entry in the same
/// save. The public cache is cleared after the commit by the data layer, so the next public read shows the change (PUB-03). Who
/// changed it and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="store">The business info store.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="validator">The form rules.</param>
/// <param name="time">The clock.</param>
/// <param name="delivery">Makes the preview addresses of the share picture.</param>
public sealed class UpdateSiteSettingsHandler(
    ISiteContentStore store,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<UpdateSiteSettingsRequest> validator,
    TimeProvider time,
    IImageDelivery delivery)
{
    private const string TargetType = SiteSettingsAuditDetail.TargetType;

    /// <summary>Saves the form.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The settings as saved, a 400 naming every field that failed, or a 409 for a stale version or a lost race.</returns>
    public async Task<Result<SiteSettingsDto>> HandleAsync(UpdateSiteSettingsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<SiteSettingsDto>(SiteContentErrors.Invalid(validation));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        try
        {
            var outcome = await unitOfWork.InTransactionAsync(token => AttemptAsync(request, version, token), cancellationToken).ConfigureAwait(false);
            if (outcome.IsFailure)
            {
                return Result.Failure<SiteSettingsDto>(outcome.Error);
            }
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<SiteSettingsDto>(EditErrors.Stale);
        }

        var view = await store.GetViewAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(SiteSettingsDto.From(view, delivery));
    }

    private async Task<Result<bool>> AttemptAsync(UpdateSiteSettingsRequest request, byte[] version, CancellationToken cancellationToken)
    {
        var current = await store.GetSettingsForUpdateAsync(cancellationToken).ConfigureAwait(false);
        var settings = current.Settings;
        if (!settings.RowVersion.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<bool>(EditErrors.Stale);
        }

        var before = ShownValues(settings);
        var now = time.GetUtcNow();
        var changes = settings.UpdateBusinessInfo(ToBusinessInfo(request), now);
        if (changes.IsFailure)
        {
            return Result.Failure<bool>(changes.Error);
        }

        var fields = changes.Value.ChangedFields.ToList();
        var phones = changes.Value.Phones;
        if (!SamePhones(current.Phones, phones))
        {
            fields.Add(BusinessInfoFields.Phones);
            store.ReplacePhones(current.Phones, phones);
            settings.MarkPhonesChanged(now);
        }

        if (fields.Count == 0)
        {
            return Result.Success(false);
        }

        audit.Record(
            AuditActions.SiteSettingsChanged,
            TargetType,
            SiteSettings.SingletonId.ToString(CultureInfo.InvariantCulture),
            SiteSettingsAuditDetail.Changed(fields, before, ShownValues(settings)));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }

    // The rows are the same when each place in the list holds the same number, label and main flag.
    private static bool SamePhones(IReadOnlyList<SitePhoneNumber> stored, IReadOnlyList<SitePhoneNumber> next) =>
        stored.Count == next.Count
        && stored.Zip(next).All(static pair =>
            string.Equals(pair.First.Number, pair.Second.Number, StringComparison.Ordinal)
            && string.Equals(pair.First.Label, pair.Second.Label, StringComparison.Ordinal)
            && pair.First.IsMain == pair.Second.IsMain);

    // The values the audit entry may copy: the business name and the links. Everything else is only named.
    private static Dictionary<string, string?> ShownValues(SiteSettings settings) => new(StringComparer.Ordinal)
    {
        [BusinessInfoFields.BusinessName] = settings.BusinessName,
        [BusinessInfoFields.DirectionsUrl] = settings.DirectionsUrl,
        [BusinessInfoFields.MapEmbedUrl] = settings.MapEmbedUrl,
        [BusinessInfoFields.MessengerUrl] = settings.MessengerUrl,
        [BusinessInfoFields.FacebookUrl] = settings.FacebookUrl,
        [BusinessInfoFields.InstagramUrl] = settings.InstagramUrl,
        [BusinessInfoFields.TiktokUrl] = settings.TikTokUrl,
    };

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
        request.QuoteAlertsEmail,
        [.. (request.Phones ?? []).Select(static phone => new BusinessPhone(phone.Number ?? string.Empty, phone.Label, phone.IsMain))]);
}

using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: read the site settings for staff (D-29, CONT-01). One handler per use case, no mediator (PRD section 3.3). The settings
/// are read from the database, not a cache, because the Business Info form needs the version a save will be checked against. A
/// failure (for example a missing row) is a programming or infrastructure error and is not turned into a result.
/// </summary>
/// <param name="store">The business info store.</param>
/// <param name="delivery">Makes the preview addresses of the share picture.</param>
public sealed class GetSiteSettingsHandler(ISiteContentStore store, IImageDelivery delivery)
{
    /// <summary>Returns the current site settings.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The settings.</returns>
    public async Task<Result<SiteSettingsDto>> HandleAsync(CancellationToken cancellationToken)
    {
        var view = await store.GetViewAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(SiteSettingsDto.From(view, delivery));
    }
}

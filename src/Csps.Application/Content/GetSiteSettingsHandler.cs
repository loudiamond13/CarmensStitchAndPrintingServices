using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: read the site settings (D-29). One handler per use case, no mediator (PRD section 3.3). The settings
/// come from the cached <see cref="ISiteSettingsReader"/>; a reader failure (for example a missing row) is a
/// programming or infrastructure error and is not turned into a result.
/// </summary>
/// <param name="reader">The cached settings reader.</param>
public sealed class GetSiteSettingsHandler(ISiteSettingsReader reader)
{
    /// <summary>Returns the current site settings.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The settings.</returns>
    public async Task<Result<SiteSettingsDto>> HandleAsync(CancellationToken cancellationToken)
    {
        var snapshot = await reader.GetAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(SiteSettingsDto.From(snapshot));
    }
}

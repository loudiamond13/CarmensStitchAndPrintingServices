using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: read the weekly hours for the Hours tab (CONT-01). The hours are read from the database, not a cache, because the form needs
/// the version a save will be checked against. A failure (for example a missing row) is a programming or infrastructure error and is not
/// turned into a result.
/// </summary>
/// <param name="store">The site content store.</param>
public sealed class GetOpeningHoursHandler(ISiteContentStore store)
{
    /// <summary>Returns the seven days and their version.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The hours.</returns>
    public async Task<Result<OpeningHoursDto>> HandleAsync(CancellationToken cancellationToken)
    {
        var view = await store.GetHoursViewAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(OpeningHoursDto.From(view));
    }
}

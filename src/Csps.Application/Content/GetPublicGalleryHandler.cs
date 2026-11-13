using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: the Gallery data for an anonymous visitor (GAL-01, D-10): every public item in gallery order with the pill counts. The snapshot is
/// cached and carries its own ETag, so the controller can answer a repeat visit with 304. A reader failure is an infrastructure error and is
/// not turned into a result.
/// </summary>
/// <param name="reader">The public content reader.</param>
public sealed class GetPublicGalleryHandler(IPublicContentReader reader)
{
    /// <summary>Returns the Gallery snapshot.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The snapshot.</returns>
    public async Task<Result<PublicGallerySnapshot>> HandleAsync(CancellationToken cancellationToken)
    {
        var snapshot = await reader.GetGalleryAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(snapshot);
    }
}

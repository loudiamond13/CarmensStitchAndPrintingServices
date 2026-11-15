using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: the public site facts for an anonymous visitor (PUB-02). The snapshot is cached and carries its own ETag, so the
/// controller can answer a repeat visit with 304. A reader failure is an infrastructure error and is not turned into a result.
/// </summary>
/// <param name="reader">The public content reader.</param>
public sealed class GetPublicSiteHandler(IPublicContentReader reader)
{
    /// <summary>Returns the public site snapshot.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The snapshot.</returns>
    public async Task<Result<PublicSiteSnapshot>> HandleAsync(CancellationToken cancellationToken)
    {
        var snapshot = await reader.GetSiteAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(snapshot);
    }
}

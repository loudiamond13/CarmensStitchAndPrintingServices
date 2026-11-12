using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: the shown product lines for an anonymous visitor (PUB-02). The snapshot is cached and carries its own ETag, so the
/// controller can answer a repeat visit with 304. A reader failure is an infrastructure error and is not turned into a result.
/// </summary>
/// <param name="reader">The public content reader.</param>
public sealed class GetPublicProductLinesHandler(IPublicContentReader reader)
{
    /// <summary>Returns the product lines snapshot.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The snapshot.</returns>
    public async Task<Result<PublicProductLinesSnapshot>> HandleAsync(CancellationToken cancellationToken)
    {
        var snapshot = await reader.GetProductLinesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(snapshot);
    }
}

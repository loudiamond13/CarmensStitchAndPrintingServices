using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: the Home page data for an anonymous visitor (PUB-02, CONT-03): the line cards and the first three shown testimonials. The
/// snapshot is cached and carries its own ETag, so the controller can answer a repeat visit with 304. A reader failure is an
/// infrastructure error and is not turned into a result.
/// </summary>
/// <param name="reader">The public content reader.</param>
public sealed class GetPublicHomeHandler(IPublicContentReader reader)
{
    /// <summary>The number of testimonials the Home page shows.</summary>
    public const int TestimonialLimit = 3;

    /// <summary>Returns the Home snapshot.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The snapshot.</returns>
    public async Task<Result<PublicHomeSnapshot>> HandleAsync(CancellationToken cancellationToken)
    {
        var snapshot = await reader.GetHomeAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(snapshot);
    }
}

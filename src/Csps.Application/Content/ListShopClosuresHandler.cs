using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager lists the upcoming closures (CONT-04): every closure whose last day is today or later in business time, by
/// first day, each with the version an edit must send back. Past closures are not listed. The list is read from the database, not a cache.
/// </summary>
/// <param name="store">The site content store.</param>
/// <param name="calendar">The business calendar.</param>
public sealed class ListShopClosuresHandler(ISiteContentStore store, IBusinessCalendar calendar)
{
    /// <summary>Returns the upcoming closures.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The closures, earliest first.</returns>
    public async Task<Result<IReadOnlyList<ShopClosureDto>>> HandleAsync(CancellationToken cancellationToken)
    {
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var closures = await store.GetUpcomingClosuresAsync(clock.Today, cancellationToken).ConfigureAwait(false);
        return Result.Success<IReadOnlyList<ShopClosureDto>>([.. closures.Select(ShopClosureDto.From)]);
    }
}

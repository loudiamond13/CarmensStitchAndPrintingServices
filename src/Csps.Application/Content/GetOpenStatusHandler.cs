using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Use case: whether the shop is open now (PUB-05, D-22). The hours come from the public site snapshot, which is cached and cleared by
/// every content change, and the clock from the business calendar, so the answer is worked out in the business zone and costs no query
/// per visit. Closures ride in the same snapshot, so a closure day is closed whatever the weekly hours say. A reader failure is an infrastructure error and is not turned into a result.
/// </summary>
/// <param name="reader">The public content reader.</param>
/// <param name="calendar">The business calendar.</param>
public sealed class GetOpenStatusHandler(IPublicContentReader reader, IBusinessCalendar calendar)
{
    /// <summary>Works out the open status at this instant.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The open status.</returns>
    public async Task<Result<OpenStatusDto>> HandleAsync(CancellationToken cancellationToken)
    {
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var snapshot = await reader.GetSiteAsync(cancellationToken).ConfigureAwait(false);
        var week = snapshot.Site.Hours.Select(static day => day.ToDomain()).ToList();
        return Result.Success(OpenStatusDto.From(OpenStatus.Compute(clock, week, snapshot.Closures)));
    }
}

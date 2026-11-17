using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>Compile-only stub for the RED commit.</summary>
/// <param name="pages">Maps a cut path to a page key.</param>
/// <param name="visits">The visit store.</param>
/// <param name="calendar">The business clock.</param>
/// <param name="validator">Checks the body.</param>
public sealed class CollectVitalsHandler(IPublicPageResolver pages, IAnalyticsVisits visits, IBusinessCalendar calendar, IValidator<VitalsRequest> validator)
{
    /// <summary>Stub.</summary>
    /// <param name="request">The body.</param>
    /// <param name="context">The call context.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success.</returns>
    public Task<Result> HandleAsync(VitalsRequest request, CollectContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(pages);
        ArgumentNullException.ThrowIfNull(visits);
        ArgumentNullException.ThrowIfNull(calendar);
        ArgumentNullException.ThrowIfNull(validator);
        return Task.FromResult(Result.Success());
    }
}

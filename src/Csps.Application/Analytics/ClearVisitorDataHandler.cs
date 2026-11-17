using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Analytics;

/// <summary>What the server knows about a Clear call: the GPC signal and the visitor id cookie, when it is well formed.</summary>
/// <param name="Gpc">True when the request carried <c>Sec-GPC: 1</c>.</param>
/// <param name="VisitorToken">The well-formed visitor id cookie value, or null when none was sent.</param>
public sealed record ClearCallContext(bool Gpc, string? VisitorToken);

/// <summary>Use case: a visitor clears their analytics rows and their consent (ANL-04).</summary>
/// <param name="visits">The visit store.</param>
/// <param name="records">Where decisions are kept.</param>
/// <param name="unitOfWork">Saves the record.</param>
/// <param name="calendar">The business clock.</param>
public sealed class ClearVisitorDataHandler(IAnalyticsVisits visits, IConsentRecords records, IUnitOfWork unitOfWork, IBusinessCalendar calendar)
{
    /// <summary>Clears one visitor.</summary>
    /// <param name="context">What the server read from the request.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The outcome the controller answers with.</returns>
    public Task<Result<ConsentOutcome>> HandleAsync(ClearCallContext context, CancellationToken cancellationToken)
    {
        _ = (visits, records, unitOfWork, calendar);
        throw new NotImplementedException();
    }
}

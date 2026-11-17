using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Common;
using Csps.Domain.Content;

namespace Csps.Application.Analytics;

/// <summary>What the server knows about a Clear call: the GPC signal and the visitor id cookie, when it is well formed.</summary>
/// <param name="Gpc">True when the request carried <c>Sec-GPC: 1</c>.</param>
/// <param name="VisitorToken">The well-formed visitor id cookie value, or null when none was sent.</param>
public sealed record ClearCallContext(bool Gpc, string? VisitorToken);

/// <summary>
/// Use case: a visitor clears their cookies and data (ANL-04, D-19, D-31, D-41). The visitor is chosen only by the HttpOnly visitor id
/// cookie, never by an id in the request (CWE-639). The rows of that visitor go, whether or not any exist; the daily counts have no visitor
/// id and stay. The call records a reset decision (stats off, map off, a new consent chain) and always answers the same way.
/// </summary>
/// <param name="visits">The visit store.</param>
/// <param name="records">Where decisions are kept.</param>
/// <param name="unitOfWork">Saves the record.</param>
/// <param name="calendar">The business clock: the decision time and day.</param>
public sealed class ClearVisitorDataHandler(IAnalyticsVisits visits, IConsentRecords records, IUnitOfWork unitOfWork, IBusinessCalendar calendar)
{
    /// <summary>Clears one visitor.</summary>
    /// <param name="context">What the server read from the request.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The outcome the controller answers with: the reset state, its cookie value and an order to expire the visitor id.</returns>
    public async Task<Result<ConsentOutcome>> HandleAsync(ClearCallContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.VisitorToken is { Length: > 0 } token)
        {
            await visits.DeleteForVisitorAsync(VisitorKey.HashVisitor(token), cancellationToken).ConfigureAwait(false);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var record = ConsentRecord.Decide(Guid.NewGuid(), LegalPages.CookiePolicyVersion, false, false, context.Gpc, ConsentSource.Clear, clock.UtcNow);
        records.Add(record);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var cookie = new ConsentCookie(record.ConsentId, record.PolicyVersion, record.Stats, record.Map, clock.Today, false);
        var response = new ConsentDecisionResponse(
            record.ConsentId.ToString("N"),
            record.PolicyVersion,
            record.Stats,
            record.Map,
            record.Gpc,
            clock.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        return Result.Success(new ConsentOutcome(response, cookie.Format(), clock.UtcNow.AddMonths(ConsentCookie.LifetimeMonths), VisitorIdAction.Expire, null));
    }
}

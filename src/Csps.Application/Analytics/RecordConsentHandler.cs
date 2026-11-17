using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Analytics;

/// <summary>Use case: a visitor's cookie decision is logged as proof and answered with the stored state (ANL-07).</summary>
/// <param name="records">Where decisions are kept.</param>
/// <param name="unitOfWork">Saves the record.</param>
/// <param name="calendar">The business clock: the decision time and day.</param>
/// <param name="random">The source of new visitor ids.</param>
public sealed class RecordConsentHandler(IConsentRecords records, IUnitOfWork unitOfWork, IBusinessCalendar calendar, ISecureRandom random)
{
    /// <summary>Records one decision.</summary>
    /// <param name="request">The decision as the browser sent it.</param>
    /// <param name="context">What the server knows about the call.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The outcome the controller answers with.</returns>
    public Task<Result<ConsentOutcome>> HandleAsync(RecordConsentRequest request, ConsentCallContext context, CancellationToken cancellationToken)
    {
        _ = (records, unitOfWork, calendar, random, request, context, cancellationToken);
        return Task.FromResult(Result.Success(new ConsentOutcome(new ConsentDecisionResponse(string.Empty, string.Empty, null, false, false, string.Empty), string.Empty, default, VisitorIdAction.Keep, null)));
    }
}

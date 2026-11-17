using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>Use case: a visitor's cookie decision is logged as proof and answered with the stored state (ANL-07).</summary>
/// <param name="records">Where decisions are kept.</param>
/// <param name="unitOfWork">Saves the record.</param>
/// <param name="calendar">The business clock: the decision time and day.</param>
/// <param name="random">The source of new visitor ids.</param>
/// <param name="validator">Checks the decision's fields.</param>
public sealed class RecordConsentHandler(IConsentRecords records, IUnitOfWork unitOfWork, IBusinessCalendar calendar, ISecureRandom random, IValidator<RecordConsentRequest> validator)
{
    private const string FieldRequired = "This is required.";

    /// <summary>Records one decision.</summary>
    /// <param name="request">The decision as the browser sent it.</param>
    /// <param name="context">What the server knows about the call.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The outcome the controller answers with, or a 400 naming the bad fields.</returns>
    public async Task<Result<ConsentOutcome>> HandleAsync(RecordConsentRequest request, ConsentCallContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(context);
        _ = (random, validator);

        var missing = new Dictionary<string, string[]>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(request.PolicyVersion))
        {
            missing["policyVersion"] = [FieldRequired];
        }

        if (string.IsNullOrWhiteSpace(request.Source))
        {
            missing["source"] = [FieldRequired];
        }

        if (missing.Count > 0)
        {
            return Result.Failure<ConsentOutcome>(Error.Validation("consent.validation", "Check the highlighted fields.", missing));
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var chain = Guid.TryParseExact(request.ConsentId, "N", out var given) && given != Guid.Empty ? given : Guid.NewGuid();
        var record = ConsentRecord.Decide(chain, request.PolicyVersion!, request.Stats, request.Map, context.Gpc, SourceOf(request.Source!), clock.UtcNow);
        records.Add(record);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var cookie = new ConsentCookie(record.ConsentId, record.PolicyVersion, record.Stats, record.Map, clock.Today, false);
        var response = new ConsentDecisionResponse(record.ConsentId.ToString("N"), record.PolicyVersion, record.Stats, record.Map, record.Gpc, clock.Today.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
        return Result.Success(new ConsentOutcome(response, cookie.Format(), clock.UtcNow.AddMonths(ConsentCookie.LifetimeMonths), VisitorIdAction.Keep, null));
    }

    private static ConsentSource SourceOf(string source) => source switch
    {
        "settings" => ConsentSource.Settings,
        "map-link" => ConsentSource.MapLink,
        _ => ConsentSource.Bar,
    };
}

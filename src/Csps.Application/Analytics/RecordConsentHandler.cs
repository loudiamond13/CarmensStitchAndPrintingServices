using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>
/// Use case: a visitor's cookie decision is logged as proof and answered with the stored state (ANL-07). The server decides what the decision
/// means: under the GPC signal visitor stats are stored off whatever the body says (D-20), and a decision made under an old policy version is
/// refused (D-22).
/// </summary>
/// <param name="records">Where decisions are kept.</param>
/// <param name="unitOfWork">Saves the record.</param>
/// <param name="calendar">The business clock: the decision time and day.</param>
/// <param name="random">The source of new visitor ids.</param>
/// <param name="validator">Checks the decision's fields.</param>
public sealed class RecordConsentHandler(IConsentRecords records, IUnitOfWork unitOfWork, IBusinessCalendar calendar, ISecureRandom random, IValidator<RecordConsentRequest> validator)
{
    /// <summary>Records one decision.</summary>
    /// <param name="request">The decision as the browser sent it.</param>
    /// <param name="context">What the server knows about the call.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The outcome the controller answers with, a 400 naming the bad fields, or a 409 for an old policy version.</returns>
    public async Task<Result<ConsentOutcome>> HandleAsync(RecordConsentRequest request, ConsentCallContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(context);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<ConsentOutcome>(ValidationResults.ToError(validation, ConsentErrors.ValidationCode, ConsentErrors.ValidationMessage));
        }

        if (!string.Equals(request.PolicyVersion, LegalPages.CookiePolicyVersion, StringComparison.Ordinal))
        {
            return Result.Failure<ConsentOutcome>(ConsentErrors.PolicyChanged);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var chain = Guid.TryParseExact(request.ConsentId, "N", out var given) && given != Guid.Empty ? given : Guid.NewGuid();
        var stats = context.Gpc ? false : request.Stats;
        var record = ConsentRecord.Decide(chain, LegalPages.CookiePolicyVersion, stats, request.Map, context.Gpc, ConsentSources.From(request.Source), clock.UtcNow);
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
        // Stats are on only without GPC (the record holds false under it), so one test decides: a logged yes gets a visitor id,
        // anything else takes it away. Past analytics rows are kept either way (D-41).
        var visitor = record.Stats != true ? VisitorIdAction.Expire : context.HasVisitorId ? VisitorIdAction.Keep : VisitorIdAction.Issue;
        var token = visitor == VisitorIdAction.Issue ? random.NewToken() : null;
        return Result.Success(new ConsentOutcome(response, cookie.Format(), clock.UtcNow.AddMonths(ConsentCookie.LifetimeMonths), visitor, token));
    }
}

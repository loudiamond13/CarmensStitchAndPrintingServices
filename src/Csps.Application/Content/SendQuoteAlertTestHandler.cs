using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager sends a test email to the saved Quote alerts address (D-11). It goes to the saved address only, never to one in
/// the request. The email and the <c>quote-alerts.test-sent</c> audit entry are saved together. The audit entry has no detail and
/// nothing is logged, so the address is never written outside the outbox (CWE-532).
/// </summary>
/// <param name="store">Reads the saved Quote alerts address.</param>
/// <param name="outbox">Queues the email.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">Saves the email and the audit entry in one save.</param>
public sealed class SendQuoteAlertTestHandler(ISiteContentStore store, IEmailOutbox outbox, IAuditTrail audit, IUnitOfWork unitOfWork)
{
    /// <summary>Queues the test email.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 409 when no address is saved, or a 422 when the saved address can never receive mail.</returns>
    public async Task<Result> HandleAsync(CancellationToken cancellationToken)
    {
        var address = (await store.GetQuoteAlertsEmailAsync(cancellationToken).ConfigureAwait(false)).Trim();
        if (address.Length == 0)
        {
            return Result.Failure(SiteContentErrors.NoQuoteAlertsAddress);
        }

        try
        {
            await outbox.EnqueueAsync(new QuoteAlertTestEmail(address), cancellationToken).ConfigureAwait(false);
        }
        catch (UndeliverableRecipientException)
        {
            return Result.Failure(SiteContentErrors.QuoteAlertsAddressUndeliverable);
        }

        audit.Record(
            AuditActions.QuoteAlertsTestSent,
            SiteSettingsAuditDetail.TargetType,
            SiteSettings.SingletonId.ToString(CultureInfo.InvariantCulture),
            null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}

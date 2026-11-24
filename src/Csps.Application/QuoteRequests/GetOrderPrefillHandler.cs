using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.QuoteRequests;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Use case: staff of either role read the values the New Order form starts with for a quote request (INQ-06, D-20). Nothing is
/// saved here; the order save sends the request id back. A Converted request still answers, and the save is what refuses a second
/// order (D-23). The phone is the display form, which the order number rule accepts (Pitfall 7). The suggested product type is the
/// first active type filed under the chosen line, in the order the product type list shows (Phase 11 D-09).
/// </summary>
public sealed class GetOrderPrefillHandler(IQuoteRequestReader reader, IBusinessCalendar calendar, IRequestContext requestContext)
{
    /// <summary>Reads the prefill.</summary>
    /// <param name="id">The request id.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The form values, a 404 when the request does not exist, or a 401 when the token names no usable account.</returns>
    public async Task<Result<OrderPrefillResponse>> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderPrefillResponse>(AuthErrors.SessionEnded);
        }

        var view = await reader.GetOrderPrefillAsync(id, cancellationToken).ConfigureAwait(false);
        if (view is null)
        {
            return Result.Failure<OrderPrefillResponse>(QuoteRequestErrors.NotFound);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var receivedOn = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(view.ReceivedAtUtc, clock.Zone).DateTime);
        var productTypeId = view.ProductChoice == QuoteProductChoice.Line
            ? view.LineProductTypes
                .OrderBy(static type => type.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(static type => type.Id)
                .Select(static type => (Guid?)type.Id)
                .FirstOrDefault()
            : null;

        return Result.Success(new OrderPrefillResponse(
            view.Id,
            view.CustomerName,
            view.TeamName,
            PhilippinePhone.TryParse(view.ContactNumberE164, out var phone) ? phone.Display : view.ContactNumberE164,
            view.Email,
            view.Message,
            receivedOn,
            productTypeId));
    }
}

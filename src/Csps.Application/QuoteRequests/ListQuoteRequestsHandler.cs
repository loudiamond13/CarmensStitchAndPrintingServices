using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.QuoteRequests;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Use case: staff of either role read the quote request inbox (INQ-05, D-13). Every figure comes from the reader; the handler
/// only puts the phone in its display form and the enums in their wire keys.
/// </summary>
public sealed class ListQuoteRequestsHandler(IQuoteRequestReader reader, IRequestContext requestContext)
{
    private const int DefaultSize = 20;

    /// <summary>Lists the first page of the open requests.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, or a 401 when the token names no usable account.</returns>
    public async Task<Result<QuoteRequestListResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure<QuoteRequestListResponse>(AuthErrors.SessionEnded);
        }

        var page = await reader.ListAsync(new QuoteRequestListQuery(QuoteRequestGroup.Open, 1, DefaultSize), cancellationToken).ConfigureAwait(false);
        IReadOnlyList<QuoteRequestListItem> items = [.. page.Items.Select(ToItem)];
        return Result.Success(new QuoteRequestListResponse(items, page.Total, 1, DefaultSize));
    }

    private static QuoteRequestListItem ToItem(QuoteRequestListRow row) => new(
        row.Id,
        row.ReceivedAtUtc,
        row.CustomerName,
        row.TeamName,
        PhilippinePhone.TryParse(row.ContactNumberE164, out var phone) ? phone.Display : row.ContactNumberE164,
        row.ProductChoice is { } choice ? new QuoteRequestProduct(QuoteProductChoiceNames.ToKey(choice), row.ProductTitle) : null,
        row.QuantityRange is { } range ? QuoteQuantityRangeNames.ToKey(range) : null,
        row.PhotoCount,
        row.StoredPhotoCount,
        row.PhotosRemoved,
        QuoteRequestStatusNames.ToKey(row.Status));
}

using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.QuoteRequests;
using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Use case: staff of either role read the quote request inbox (INQ-05, D-13, D-18). The query is checked first and the port is never
/// called for a bad one. Every figure comes from the reader; the handler only puts the phone in its display form and the enums in their
/// wire keys.
/// </summary>
public sealed class ListQuoteRequestsHandler(IQuoteRequestReader reader, IRequestContext requestContext, IValidator<ListQuoteRequestsRequest> validator)
{
    /// <summary>Lists one page of the inbox.</summary>
    /// <param name="request">The status, search and page.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, a 400 naming the bad fields, or a 401 when the token names no usable account.</returns>
    public async Task<Result<QuoteRequestListResponse>> HandleAsync(ListQuoteRequestsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<QuoteRequestListResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<QuoteRequestListResponse>(
                ValidationResults.ToError(validation, QuoteRequestErrors.ListValidationCode, QuoteRequestErrors.ListValidationMessage));
        }

        _ = ListQuoteRequestsRequestValidator.TryParseGroup(request.Status, out var group);
        var search = string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim();
        var query = new QuoteRequestListQuery(group, search, QuoteRequestSearchText.PhoneDigits(search), request.Page, request.Size);
        var page = await reader.ListAsync(query, cancellationToken).ConfigureAwait(false);
        IReadOnlyList<QuoteRequestListItem> items = [.. page.Items.Select(ToItem)];
        var counts = page.Counts;
        return Result.Success(new QuoteRequestListResponse(
            items,
            page.Total,
            request.Page,
            request.Size,
            new QuoteRequestCountsResponse(counts.Open, counts.Converted, counts.Closed, counts.Spam, counts.All)));
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

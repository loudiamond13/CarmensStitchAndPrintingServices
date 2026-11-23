using Csps.Domain.QuoteRequests;

namespace Csps.Application.Ports;

/// <summary>Untracked reads of quote requests for staff (INQ-05): the inbox list. Nothing here changes a request.</summary>
public interface IQuoteRequestReader
{
    /// <summary>
    /// Reads one page of the requests in a status group, newest received first and then by id descending, so paging never repeats or
    /// skips a row (D-18).
    /// </summary>
    /// <param name="query">The group and the page.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The rows of the page and the count over every page.</returns>
    Task<QuoteRequestListPage> ListAsync(QuoteRequestListQuery query, CancellationToken cancellationToken);
}

/// <summary>Which requests the status part of the inbox list keeps (D-18).</summary>
public enum QuoteRequestGroup
{
    /// <summary>New, Contacted and Quoted (the default).</summary>
    Open = 0,
}

/// <summary>The inbox list query after it was checked.</summary>
/// <param name="Group">Which statuses to keep.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="Size">Rows per page.</param>
public sealed record QuoteRequestListQuery(QuoteRequestGroup Group, int Page, int Size);

/// <summary>One request of the inbox list, as stored. The phone is still E.164; the handler makes its display form.</summary>
/// <param name="Id">The request id.</param>
/// <param name="ReceivedAtUtc">When it was received.</param>
/// <param name="CustomerName">The visitor's name.</param>
/// <param name="TeamName">The team; null when none.</param>
/// <param name="ContactNumberE164">The mobile number as E.164.</param>
/// <param name="ProductChoice">What was chosen in the product list; null when nothing.</param>
/// <param name="ProductTitle">The line title at the moment of the request; null for another choice.</param>
/// <param name="QuantityRange">The estimated quantity; null when none.</param>
/// <param name="PhotoCount">How many photos the visitor declared.</param>
/// <param name="StoredPhotoCount">How many of them arrived.</param>
/// <param name="PhotosRemoved">True when the photos were removed (a Spam move).</param>
/// <param name="Status">The status.</param>
public sealed record QuoteRequestListRow(
    Guid Id,
    DateTimeOffset ReceivedAtUtc,
    string CustomerName,
    string? TeamName,
    string ContactNumberE164,
    QuoteProductChoice? ProductChoice,
    string? ProductTitle,
    QuoteQuantityRange? QuantityRange,
    int PhotoCount,
    int StoredPhotoCount,
    bool PhotosRemoved,
    QuoteRequestStatus Status);

/// <summary>One page of the inbox list from the reader.</summary>
/// <param name="Items">The rows of the page.</param>
/// <param name="Total">How many requests match, across all pages.</param>
public sealed record QuoteRequestListPage(IReadOnlyList<QuoteRequestListRow> Items, int Total);

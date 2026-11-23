using Csps.Domain.QuoteRequests;

namespace Csps.Application.Ports;

/// <summary>Untracked reads of quote requests for staff (INQ-05): the inbox list. Nothing here changes a request.</summary>
public interface IQuoteRequestReader
{
    /// <summary>
    /// Reads one page of the requests in a status group that match the search, newest received first and then by id descending, so
    /// paging never repeats or skips a row, the count over every page, and the count of each pill, in three SQL commands (D-18).
    /// </summary>
    /// <param name="query">The group, the search and the page.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The rows of the page, the count over every page and the pill counts.</returns>
    Task<QuoteRequestListPage> ListAsync(QuoteRequestListQuery query, CancellationToken cancellationToken);

    /// <summary>Counts the requests at status New, for the badge (D-14). It is one number for every staff member.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>How many requests are at status New.</returns>
    Task<int> CountNewAsync(CancellationToken cancellationToken);
}

/// <summary>Which requests the status part of the inbox list keeps (D-18).</summary>
public enum QuoteRequestGroup
{
    /// <summary>New, Contacted and Quoted (the default).</summary>
    Open = 0,

    /// <summary>Converted into an order.</summary>
    Converted = 1,

    /// <summary>Closed with no order.</summary>
    Closed = 2,

    /// <summary>Marked Spam.</summary>
    Spam = 3,

    /// <summary>Every status.</summary>
    All = 4,
}

/// <summary>The inbox list query after it was checked.</summary>
/// <param name="Group">Which statuses to keep.</param>
/// <param name="Search">The trimmed search text for the name and team; null for no search.</param>
/// <param name="PhoneDigits">The digits to match inside the stored phone number; null when the search has too few digits.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="Size">Rows per page.</param>
public sealed record QuoteRequestListQuery(QuoteRequestGroup Group, string? Search, string? PhoneDigits, int Page, int Size);

/// <summary>How many requests each filter pill holds, over the whole table.</summary>
/// <param name="Open">New, Contacted and Quoted.</param>
/// <param name="Converted">Converted.</param>
/// <param name="Closed">Closed.</param>
/// <param name="Spam">Spam.</param>
/// <param name="All">Every request.</param>
public sealed record QuoteRequestCounts(int Open, int Converted, int Closed, int Spam, int All);

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
/// <param name="Counts">The count of each pill, ignoring the search and the page.</param>
public sealed record QuoteRequestListPage(IReadOnlyList<QuoteRequestListRow> Items, int Total, QuoteRequestCounts Counts);

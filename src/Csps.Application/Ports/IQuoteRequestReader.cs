using Csps.Application.Users;
using Csps.Domain.QuoteRequests;

namespace Csps.Application.Ports;

/// <summary>Untracked reads of quote requests for staff (INQ-05): the inbox list and one request. Nothing here changes a request.</summary>
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

    /// <summary>Reads one request with its photo places, its status history and its notes, newest first.</summary>
    /// <param name="id">The request id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The request as stored, or null when there is no such request.</returns>
    Task<QuoteRequestDetailView?> GetDetailAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Reads what the New Order form needs from one request, with the active product types filed under the chosen line (D-20).</summary>
    /// <param name="id">The request id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The request's form values, or null when there is no such request.</returns>
    Task<QuoteOrderPrefillView?> GetOrderPrefillAsync(Guid id, CancellationToken cancellationToken);
}

/// <summary>One product type that is not retired and is filed under the chosen product line (Phase 11 D-09).</summary>
/// <param name="Id">The product type id.</param>
/// <param name="Name">Its name, which orders the list as the product type list does.</param>
public sealed record QuoteLineProductType(Guid Id, string Name);

/// <summary>What the New Order form needs from one request, as stored. The phone is still E.164.</summary>
/// <param name="Id">The request id.</param>
/// <param name="ReceivedAtUtc">When it was received.</param>
/// <param name="CustomerName">The visitor's name.</param>
/// <param name="TeamName">The team; null when none.</param>
/// <param name="ContactNumberE164">The mobile number as E.164.</param>
/// <param name="Email">The email; null when none.</param>
/// <param name="Message">What the visitor wrote; null when nothing.</param>
/// <param name="ProductChoice">What was chosen in the product list; null when nothing.</param>
/// <param name="LineProductTypes">The active product types of the chosen line; empty for another choice or a deleted line.</param>
public sealed record QuoteOrderPrefillView(
    Guid Id,
    DateTimeOffset ReceivedAtUtc,
    string CustomerName,
    string? TeamName,
    string ContactNumberE164,
    string? Email,
    string? Message,
    QuoteProductChoice? ProductChoice,
    IReadOnlyList<QuoteLineProductType> LineProductTypes);

/// <summary>One photo place as stored. A place with no public id is a photo that never arrived.</summary>
/// <param name="Slot">The place, from 0.</param>
/// <param name="FileName">The file name the visitor declared.</param>
/// <param name="PublicId">The storage id; null while missing.</param>
/// <param name="Width">The upright width; null while missing.</param>
/// <param name="Height">The upright height; null while missing.</param>
public sealed record QuoteRequestPhotoRow(int Slot, string FileName, string? PublicId, int? Width, int? Height);

/// <summary>One status move as stored, with the mover's current name.</summary>
/// <param name="From">The status the request left.</param>
/// <param name="To">The status the request entered.</param>
/// <param name="ChangedBy">Who moved it; null reads as System.</param>
/// <param name="ChangedAtUtc">When it moved.</param>
public sealed record QuoteRequestHistoryRow(QuoteRequestStatus From, QuoteRequestStatus To, ActorRef? ChangedBy, DateTimeOffset ChangedAtUtc);

/// <summary>One staff note as stored, with the author's current name.</summary>
/// <param name="Id">The note id.</param>
/// <param name="Text">The note.</param>
/// <param name="CreatedBy">Who wrote it; null only when the account row is gone.</param>
/// <param name="CreatedAtUtc">When it was written.</param>
public sealed record QuoteRequestNoteRow(Guid Id, string Text, ActorRef? CreatedBy, DateTimeOffset CreatedAtUtc);

/// <summary>One request as stored. The phone is still E.164; the handler makes its display form and the photo addresses.</summary>
/// <param name="Id">The request id.</param>
/// <param name="ReceivedAtUtc">When it was received.</param>
/// <param name="CustomerName">The visitor's name.</param>
/// <param name="TeamName">The team; null when none.</param>
/// <param name="ContactNumberE164">The mobile number as E.164.</param>
/// <param name="Email">The email; null when none.</param>
/// <param name="ProductChoice">What was chosen in the product list; null when nothing.</param>
/// <param name="ProductTitle">The line title at the moment of the request; null for another choice.</param>
/// <param name="QuantityRange">The estimated quantity; null when none.</param>
/// <param name="Message">What the visitor wrote; null when nothing.</param>
/// <param name="Status">The status.</param>
/// <param name="StatusChangedAtUtc">When the status last changed.</param>
/// <param name="Photos">The photo places in slot order.</param>
/// <param name="PhotosRemovedAtUtc">When the photos were removed for Spam; null while kept.</param>
/// <param name="History">The status moves, newest first.</param>
/// <param name="Notes">The staff notes, newest first.</param>
/// <param name="LastChangedBy">Who last changed the request; null when nobody has.</param>
/// <param name="LastChangedAtUtc">When it was last changed; null when never.</param>
/// <param name="RowVersion">The row version a change must send back.</param>
public sealed record QuoteRequestDetailView(
    Guid Id,
    DateTimeOffset ReceivedAtUtc,
    string CustomerName,
    string? TeamName,
    string ContactNumberE164,
    string? Email,
    QuoteProductChoice? ProductChoice,
    string? ProductTitle,
    QuoteQuantityRange? QuantityRange,
    string? Message,
    QuoteRequestStatus Status,
    DateTimeOffset StatusChangedAtUtc,
    IReadOnlyList<QuoteRequestPhotoRow> Photos,
    DateTimeOffset? PhotosRemovedAtUtc,
    IReadOnlyList<QuoteRequestHistoryRow> History,
    IReadOnlyList<QuoteRequestNoteRow> Notes,
    ActorRef? LastChangedBy,
    DateTimeOffset? LastChangedAtUtc,
    byte[] RowVersion);

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

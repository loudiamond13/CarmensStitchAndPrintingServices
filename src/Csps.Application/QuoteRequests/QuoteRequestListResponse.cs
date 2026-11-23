namespace Csps.Application.QuoteRequests;

/// <summary>What the visitor chose in the product list (D-24).</summary>
/// <param name="Choice">One of <c>line</c>, <c>custom</c> or <c>not-sure</c>.</param>
/// <param name="Title">The line title at the moment of the request; null for another choice.</param>
public sealed record QuoteRequestProduct(string Choice, string? Title);

/// <summary>One request in the staff inbox (INQ-05). It carries no email and no message.</summary>
/// <param name="Id">The request id.</param>
/// <param name="ReceivedAtUtc">When the request was received, in UTC.</param>
/// <param name="CustomerName">The visitor's name.</param>
/// <param name="TeamName">The team or organization; null when none.</param>
/// <param name="ContactNumber">The mobile number in its display form, such as <c>0917 123 4567</c>.</param>
/// <param name="Product">What the visitor chose; null when nothing was chosen.</param>
/// <param name="Quantity">The estimated quantity key such as <c>21-50</c>; null when none was chosen.</param>
/// <param name="PhotoCount">How many photos the visitor declared.</param>
/// <param name="StoredPhotoCount">How many of the declared photos arrived.</param>
/// <param name="PhotosRemoved">True when the stored photos were removed because the request was marked Spam.</param>
/// <param name="Status">The status key: new, contacted, quoted, converted, closed or spam.</param>
public sealed record QuoteRequestListItem(
    Guid Id,
    DateTimeOffset ReceivedAtUtc,
    string CustomerName,
    string? TeamName,
    string ContactNumber,
    QuoteRequestProduct? Product,
    string? Quantity,
    int PhotoCount,
    int StoredPhotoCount,
    bool PhotosRemoved,
    string Status);

/// <summary>The number of requests behind each filter pill, over the whole table: the search and the page do not change them.</summary>
/// <param name="Open">New, Contacted and Quoted.</param>
/// <param name="Converted">Converted into an order.</param>
/// <param name="Closed">Closed with no order.</param>
/// <param name="Spam">Marked Spam.</param>
/// <param name="All">Every request.</param>
public sealed record QuoteRequestCountsResponse(int Open, int Converted, int Closed, int Spam, int All);

/// <summary>One page of the staff inbox (INQ-05).</summary>
/// <param name="Items">The rows of this page.</param>
/// <param name="Total">How many requests match the status and search, across all pages.</param>
/// <param name="Page">The page number asked for.</param>
/// <param name="Size">The page size asked for.</param>
/// <param name="Counts">The count of each filter pill.</param>
public sealed record QuoteRequestListResponse(IReadOnlyList<QuoteRequestListItem> Items, int Total, int Page, int Size, QuoteRequestCountsResponse Counts);

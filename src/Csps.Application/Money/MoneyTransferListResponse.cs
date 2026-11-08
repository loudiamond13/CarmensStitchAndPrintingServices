namespace Csps.Application.Money;

/// <summary>One page of staff money transfers, newest first (MONEY-03, D-48).</summary>
/// <param name="Items">The transfers of this page.</param>
/// <param name="Total">How many transfers match across all pages.</param>
/// <param name="Page">The page number asked for.</param>
/// <param name="PageSize">The page size asked for.</param>
public sealed record MoneyTransferListResponse(IReadOnlyList<MoneyTransferResponse> Items, int Total, int Page, int PageSize);

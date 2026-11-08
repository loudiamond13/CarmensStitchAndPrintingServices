namespace Csps.Application.Money;

/// <summary>The ledger page query (MONEY-02). Every part is optional.</summary>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
/// <param name="Deleted">True to show deleted transfers too; only a Manager may ask (D-30, D-31).</param>
public sealed record GetLedgerRequest(int Page = 1, int PageSize = GetLedgerRequest.DefaultPageSize, bool Deleted = false)
{
    /// <summary>The page size used when the request names none.</summary>
    public const int DefaultPageSize = 20;
}

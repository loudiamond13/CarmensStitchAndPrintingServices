namespace Csps.Application.Audit;

/// <summary>The audit-log query (AUDIT-02). With no dates the range is the last 7 business days.</summary>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Entries per page, from 1 to 100.</param>
public sealed record ListAuditLogRequest(int Page = 1, int PageSize = ListAuditLogRequest.DefaultPageSize)
{
    /// <summary>The page size used when the caller sends none.</summary>
    public const int DefaultPageSize = 20;
}

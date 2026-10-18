namespace Csps.Application.Users;

/// <summary>The roster query (USER-01). Every part is optional.</summary>
/// <param name="Q">Search text for the name or email; blank means no search.</param>
/// <param name="Role"><c>admin</c> or <c>manager</c>; none means both.</param>
/// <param name="Status"><c>active</c>, <c>inactive</c> or <c>locked</c>; none means all.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
public sealed record ListUsersRequest(string? Q = null, string? Role = null, string? Status = null, int Page = 1, int PageSize = ListUsersRequest.DefaultPageSize)
{
    /// <summary>The page size used when the caller sends none.</summary>
    public const int DefaultPageSize = 20;
}

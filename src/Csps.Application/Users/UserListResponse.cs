namespace Csps.Application.Users;

/// <summary>One person in the roster (USER-01).</summary>
/// <param name="Id">The account id.</param>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Email">The sign-in email.</param>
/// <param name="Role">The single role, <c>Admin</c> or <c>Manager</c>.</param>
/// <param name="Status"><c>active</c>, <c>inactive</c> or <c>locked</c> (see <see cref="UserStatuses"/>).</param>
/// <param name="InviteState"><c>none</c>, <c>pending</c> or <c>expired</c> (see <see cref="InviteStates"/>).</param>
/// <param name="CreatedAt">When the account was created, in UTC.</param>
public sealed record UserListItem(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string Status,
    string InviteState,
    DateTimeOffset CreatedAt);

/// <summary>One page of the roster.</summary>
/// <param name="Items">The rows of this page.</param>
/// <param name="Total">How many people match, across all pages.</param>
/// <param name="Page">The page number asked for.</param>
/// <param name="PageSize">The page size asked for.</param>
public sealed record UserListResponse(IReadOnlyList<UserListItem> Items, int Total, int Page, int PageSize);

using Csps.Application.Users;

namespace Csps.Application.Ports;

/// <summary>Read-only views of staff accounts. Application never sees Identity: the implementation maps to these records.</summary>
public interface IUserDirectory
{
    /// <summary>Reads the profile of one account, straight from the user row (D-08).</summary>
    /// <param name="userId">The account id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The profile, or null when the account does not exist or was deleted.</returns>
    Task<ProfileView?> GetProfileAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Lists staff for the roster (USER-01): deleted people never appear, the order is first name, last name, id.</summary>
    /// <param name="query">The checked filters and page.</param>
    /// <param name="now">The current instant, to tell a live invitation from an expired one.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The page and the total number of matches.</returns>
    Task<UserListPage> ListUsersAsync(UserListQuery query, DateTimeOffset now, CancellationToken cancellationToken);

    /// <summary>
    /// Reads one person for the Edit panel (USER-01, SEC-08): the account row, and the names of who created and last changed it,
    /// read from those people's own rows when they are read (D-08).
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="now">The current instant, to tell a live invitation from an expired one.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The person, or null when the account does not exist or was deleted (D-09).</returns>
    Task<UserDetailView?> GetUserAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken);
}

/// <summary>A checked roster query: the search text is trimmed and not blank, the role and status are known values.</summary>
/// <param name="Search">Text to find in the first name, last name, full name or email; null for no search.</param>
/// <param name="Role">The role name (<c>Admin</c> or <c>Manager</c>); null for both.</param>
/// <param name="Status">A <see cref="UserStatuses"/> value; null for all.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
public sealed record UserListQuery(string? Search, string? Role, string? Status, int Page, int PageSize);

/// <summary>One page of the roster and the number of matches over all pages.</summary>
/// <param name="Items">The rows of the page.</param>
/// <param name="Total">All matching rows.</param>
public sealed record UserListPage(IReadOnlyList<UserListItem> Items, int Total);

/// <summary>What a staff member sees about themselves.</summary>
/// <param name="Id">The account id.</param>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Email">The sign-in email.</param>
/// <param name="Role">The single role, <c>Admin</c> or <c>Manager</c>.</param>
/// <param name="PendingEmail">The new email awaiting confirmation; null when no change is pending.</param>
/// <param name="MemberSince">When the account was created.</param>
/// <param name="Version">The edit version a save must send back (SEC-07).</param>
public sealed record ProfileView(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string? PendingEmail,
    DateTimeOffset MemberSince,
    Guid Version);

/// <summary>One person as a Manager sees them in the Edit panel.</summary>
/// <param name="Id">The account id.</param>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Email">The sign-in email.</param>
/// <param name="Role">The single role, <c>Admin</c> or <c>Manager</c>.</param>
/// <param name="Status">A <see cref="UserStatuses"/> value.</param>
/// <param name="InviteState">An <see cref="InviteStates"/> value.</param>
/// <param name="CreatedAt">When the account was created.</param>
/// <param name="HasPassword">True once a password is set.</param>
/// <param name="ManagerLocked">True while a Manager's lock is on, even when the status shows Inactive.</param>
/// <param name="PendingEmail">The new email awaiting confirmation; null when no change is pending.</param>
/// <param name="UpdatedAt">When the account was last changed; null if never.</param>
/// <param name="Version">The edit version a save must send back (SEC-07).</param>
/// <param name="RecordedBy">Who created the account; null when the system did.</param>
/// <param name="LastChangedBy">Who last changed the account; null when the system did or it was never changed.</param>
public sealed record UserDetailView(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string Status,
    string InviteState,
    DateTimeOffset CreatedAt,
    bool HasPassword,
    bool ManagerLocked,
    string? PendingEmail,
    DateTimeOffset? UpdatedAt,
    Guid Version,
    ActorRef? RecordedBy,
    ActorRef? LastChangedBy);

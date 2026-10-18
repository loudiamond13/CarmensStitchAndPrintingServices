namespace Csps.Application.Ports;

/// <summary>Read-only views of staff accounts. Application never sees Identity: the implementation maps to these records.</summary>
public interface IUserDirectory
{
    /// <summary>Reads the profile of one account, straight from the user row (D-08).</summary>
    /// <param name="userId">The account id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The profile, or null when the account does not exist or was deleted.</returns>
    Task<ProfileView?> GetProfileAsync(Guid userId, CancellationToken cancellationToken);
}

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

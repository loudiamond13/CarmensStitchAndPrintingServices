using Csps.Application.Ports;

namespace Csps.Application.Profile;

/// <summary>The signed-in staff member's own profile (PROF-01).</summary>
/// <param name="Id">The account id.</param>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Email">The sign-in email.</param>
/// <param name="Role">The single role, <c>Admin</c> or <c>Manager</c>.</param>
/// <param name="PendingEmail">The new email awaiting confirmation; null when no change is pending.</param>
/// <param name="MemberSince">When the account was created, in UTC.</param>
/// <param name="Version">The edit version to send back with the next save (SEC-07).</param>
public sealed record ProfileResponse(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string? PendingEmail,
    DateTimeOffset MemberSince,
    Guid Version)
{
    /// <summary>Maps the read model to the response.</summary>
    /// <param name="view">The profile read.</param>
    /// <returns>The response.</returns>
    public static ProfileResponse From(ProfileView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new ProfileResponse(view.Id, view.FirstName, view.LastName, view.Email, view.Role, view.PendingEmail, view.MemberSince, view.Version);
    }
}

using Csps.Application.Ports;

namespace Csps.Application.Users;

/// <summary>
/// A person named in Recorded by or Last changed by (SEC-08). The name is read from that person's own row each time, so a rename
/// shows at once and no snapshot exists (D-08).
/// </summary>
/// <param name="Id">The actor's account id.</param>
/// <param name="Name">The actor's name, first then last.</param>
/// <param name="FormerStaff">True when the actor's account was deleted; the name is kept (D-11).</param>
public sealed record ActorRef(Guid Id, string Name, bool FormerStaff);

/// <summary>One person as a Manager sees them in the Edit panel (USER-01, SEC-08).</summary>
/// <param name="Id">The account id.</param>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Email">The sign-in email.</param>
/// <param name="Role">The single role, <c>Admin</c> or <c>Manager</c>.</param>
/// <param name="Status"><c>active</c>, <c>inactive</c> or <c>locked</c> (see <see cref="UserStatuses"/>).</param>
/// <param name="InviteState"><c>none</c>, <c>pending</c> or <c>expired</c> (see <see cref="InviteStates"/>).</param>
/// <param name="CreatedAt">When the account was created, in UTC.</param>
/// <param name="HasPassword">True once a password is set.</param>
/// <param name="ManagerLocked">True while a Manager's lock is on, even when the status shows inactive.</param>
/// <param name="PendingEmail">The new email awaiting confirmation; null when no change is pending.</param>
/// <param name="UpdatedAt">When the account was last changed, in UTC; null if never.</param>
/// <param name="Version">The edit version a save must send back (SEC-07).</param>
/// <param name="RecordedBy">Who created the account; null when the system did.</param>
/// <param name="LastChangedBy">Who last changed the account; null when the system did or it was never changed.</param>
public sealed record UserDetailResponse(
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
    ActorRef? LastChangedBy)
{
    /// <summary>Maps the read model to the response.</summary>
    /// <param name="view">The person read.</param>
    /// <returns>The response.</returns>
    public static UserDetailResponse From(UserDetailView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new UserDetailResponse(
            view.Id,
            view.FirstName,
            view.LastName,
            view.Email,
            view.Role,
            view.Status,
            view.InviteState,
            view.CreatedAt,
            view.HasPassword,
            view.ManagerLocked,
            view.PendingEmail,
            view.UpdatedAt,
            view.Version,
            view.RecordedBy,
            view.LastChangedBy);
    }
}

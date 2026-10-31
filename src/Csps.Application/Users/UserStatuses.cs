namespace Csps.Application.Users;

/// <summary>The status a roster row shows. Inactive wins over Locked, which wins over Active (UI-SPEC U1).</summary>
public static class UserStatuses
{
    /// <summary>Signed in and in use.</summary>
    public const string Active = "active";

    /// <summary>Deactivated by a Manager; cannot sign in (D-16).</summary>
    public const string Inactive = "inactive";

    /// <summary>Locked by a Manager (D-16). A lockout from failed passwords is not this (D-18).</summary>
    public const string Locked = "locked";

    /// <summary>Gives the status for the account flags.</summary>
    /// <param name="isActive">False once the account is deactivated.</param>
    /// <param name="managerLocked">True while a Manager's lock is on.</param>
    /// <returns>The status text.</returns>
    public static string Of(bool isActive, bool managerLocked) => !isActive ? Inactive : managerLocked ? Locked : Active;
}

/// <summary>Where an account stands on its invitation.</summary>
public static class InviteStates
{
    /// <summary>The person has a password, so no invitation is open.</summary>
    public const string None = "none";

    /// <summary>No password yet and the invitation link still works.</summary>
    public const string Pending = "pending";

    /// <summary>No password yet and no invitation link works.</summary>
    public const string Expired = "expired";

    /// <summary>Gives the invitation state for the account flags.</summary>
    /// <param name="hasPassword">True once a password is set.</param>
    /// <param name="hasLiveInvitation">True when an unused, unrevoked, unexpired invitation exists.</param>
    /// <returns>The invitation state text.</returns>
    public static string Of(bool hasPassword, bool hasLiveInvitation) => hasPassword ? None : hasLiveInvitation ? Pending : Expired;
}

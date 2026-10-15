namespace Csps.Domain.Identity;

/// <summary>Why a signed-in challenge must end with a new password (D-13).</summary>
public enum PasswordChangeReason
{
    /// <summary>A Manager set a temporary password.</summary>
    Temporary = 1,

    /// <summary>The password appeared in a breach.</summary>
    Breach = 2,
}

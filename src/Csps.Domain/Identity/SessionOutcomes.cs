namespace Csps.Domain.Identity;

/// <summary>Why a session was ended.</summary>
public enum SessionRevocationReason
{
    /// <summary>The user signed out.</summary>
    SignedOut = 1,

    /// <summary>The user signed out of all other devices.</summary>
    SignedOutOtherDevices = 2,

    /// <summary>The user ended this session from the devices page.</summary>
    DeviceSignedOut = 3,

    /// <summary>The password was reset or changed.</summary>
    PasswordReset = 4,

    /// <summary>A used refresh token was presented again outside the grace window.</summary>
    ReuseDetected = 5,

    /// <summary>The account was deactivated or locked.</summary>
    AccountInactive = 6,

    /// <summary>The session reached its fixed end.</summary>
    Expired = 7,
}

/// <summary>The decision for one presented refresh token.</summary>
public enum RotationOutcome
{
    /// <summary>The token was used and a child token was issued.</summary>
    Rotated,

    /// <summary>A just-used token was presented again; a sibling child was issued.</summary>
    GraceSibling,

    /// <summary>A used or revoked token was replayed; the whole session was revoked.</summary>
    ReuseDetected,

    /// <summary>The session is over, by revocation or by its fixed end.</summary>
    SessionEnded,
}

/// <summary>The outcome of a rotation and the token to hand to the browser, when there is one.</summary>
/// <param name="Outcome">The decision.</param>
/// <param name="NewToken">The issued token for Rotated and GraceSibling; otherwise null.</param>
public sealed record RotationResult(RotationOutcome Outcome, RefreshToken? NewToken);

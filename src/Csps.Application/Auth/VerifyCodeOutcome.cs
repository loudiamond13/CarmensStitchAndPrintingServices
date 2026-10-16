using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>Where a correct code leads next.</summary>
public enum VerifyNext
{
    /// <summary>A session started.</summary>
    SignedIn,

    /// <summary>The account must choose a new password before a session starts (D-13).</summary>
    SetNewPassword,
}

/// <summary>What a correct code hands back to the controller.</summary>
/// <param name="Next">The next step.</param>
/// <param name="Reason">Why a new password is needed; null when signed in.</param>
/// <param name="Session">The started session; null when a new password is needed.</param>
public sealed record VerifyCodeOutcome(VerifyNext Next, PasswordChangeReason? Reason, IssuedSession? Session)
{
    /// <summary>Returns the type name only, so no token reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(VerifyCodeOutcome);
}

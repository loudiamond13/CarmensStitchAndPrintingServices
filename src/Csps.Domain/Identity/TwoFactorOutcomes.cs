namespace Csps.Domain.Identity;

/// <summary>Where a sign-in challenge stands.</summary>
public enum TwoFactorChallengeStatus
{
    /// <summary>Waiting for a correct code.</summary>
    Pending,

    /// <summary>The code was right; a new password is still needed (D-13).</summary>
    AwaitingNewPassword,

    /// <summary>The sign-in finished.</summary>
    Completed,

    /// <summary>The sign-in was cancelled.</summary>
    Invalidated,
}

/// <summary>What checking a typed code decided.</summary>
public enum TwoFactorVerifyOutcome
{
    /// <summary>The code is right and is now used.</summary>
    Ok,

    /// <summary>The code is wrong; tries remain.</summary>
    Wrong,

    /// <summary>The code has no tries left.</summary>
    Exhausted,

    /// <summary>The code is past its lifetime.</summary>
    CodeExpired,

    /// <summary>The challenge is over, or the code was already used.</summary>
    ChallengeClosed,
}

/// <summary>The outcome of a code check and the tries left on the active code.</summary>
/// <param name="Outcome">What was decided.</param>
/// <param name="RemainingAttempts">Tries left on the active code after this check.</param>
public readonly record struct TwoFactorVerifyResult(TwoFactorVerifyOutcome Outcome, int RemainingAttempts);

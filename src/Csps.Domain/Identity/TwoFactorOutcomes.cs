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

/// <summary>What a resend request decided.</summary>
public enum ResendDecisionKind
{
    /// <summary>A new code may be sent.</summary>
    Allowed,

    /// <summary>The last code is too recent; see the retry-after time.</summary>
    CoolingDown,

    /// <summary>The hourly limit of codes is used up; no wait time is given (D-10).</summary>
    CapReached,

    /// <summary>The challenge is over.</summary>
    Closed,
}

/// <summary>The decision on a resend and, while cooling down, how long to wait.</summary>
/// <param name="Kind">What was decided.</param>
/// <param name="RetryAfter">Whole seconds to wait, at least 1; null unless cooling down.</param>
public readonly record struct ResendDecision(ResendDecisionKind Kind, TimeSpan? RetryAfter);

/// <summary>Limits that span several challenges of one account (D-39).</summary>
public static class TwoFactorLimits
{
    /// <summary>True when the account has reached the wrong-code limit for the rolling window.</summary>
    /// <param name="failedInWindow">Wrong codes across all challenges inside the window.</param>
    /// <param name="settings">The limits.</param>
    /// <returns>True at the cap (the 10th wrong code), false below it.</returns>
    public static bool AccountCapReached(int failedInWindow, TwoFactorSettings settings) =>
        failedInWindow >= settings.AccountFailureCap;
}

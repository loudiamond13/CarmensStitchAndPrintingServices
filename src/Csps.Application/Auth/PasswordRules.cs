using Csps.Application.Ports;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>What a flow does when the breach service gives no answer (D-14).</summary>
public enum BreachCheckMode
{
    /// <summary>Resets and must-change saves: fall back to the common-password list and accept otherwise.</summary>
    FailOpenWithFloor,

    /// <summary>Invite acceptance (D-29): an unreachable service means the password cannot be saved.</summary>
    FailClosed,
}

/// <summary>The verdict of <see cref="PasswordRules"/>.</summary>
public enum PasswordRulesStatus
{
    /// <summary>The password may be saved.</summary>
    Accepted,

    /// <summary>The password is refused; <see cref="PasswordRulesResult.Message"/> says why.</summary>
    Rejected,

    /// <summary>Fail-closed flow and the breach service gave no answer; nothing may be saved.</summary>
    CheckUnavailable,
}

/// <summary>The outcome of checking a new password.</summary>
/// <param name="Status">The verdict.</param>
/// <param name="Message">The plain-English reason for a rejection or an unavailable check; null when accepted.</param>
/// <param name="BreachCheckSkipped">True when the password was accepted without a breach answer, so the caller audits
/// <c>auth.breach-check-unavailable</c> and marks the account for a re-check (D-18).</param>
public sealed record PasswordRulesResult(PasswordRulesStatus Status, string? Message, bool BreachCheckSkipped);

/// <summary>
/// The full new-password check (AUTH-11, D-11, D-12, D-14, D-15): the owner's rule first, then the breached-password
/// service. A failure of the service follows <see cref="BreachCheckMode"/>.
/// </summary>
/// <param name="pwned">The breach service.</param>
/// <param name="common">The local list of the most common passwords, used when the breach service is down.</param>
public sealed class PasswordRules(IPwnedPasswords pwned, ICommonPasswords common)
{
    /// <summary>Shown when the password is in a known breach.</summary>
    public const string BreachedMessage = "This password has appeared in a data breach. Choose a different one.";

    /// <summary>Shown when the breach service is down and the password is on the local common-password list.</summary>
    public const string TooCommonMessage = "This password is too common. Choose a different one.";

    /// <summary>Shown when a fail-closed flow cannot get an answer from the breach service.</summary>
    public const string CheckUnavailableMessage = "We couldn't check your password right now.";

    /// <summary>Checks a new password.</summary>
    /// <param name="password">The password as typed.</param>
    /// <param name="personal">The account details it must not contain.</param>
    /// <param name="mode">What to do when the breach service gives no answer.</param>
    /// <param name="cancellationToken">Cancels the check.</param>
    /// <returns>The verdict.</returns>
    public async Task<PasswordRulesResult> CheckAsync(
        string password,
        PersonalInfo personal,
        BreachCheckMode mode,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(password);
        ArgumentNullException.ThrowIfNull(personal);

        var failure = PasswordPolicy.Check(password, personal);
        if (failure is not null)
        {
            return new PasswordRulesResult(PasswordRulesStatus.Rejected, PasswordPolicy.MessageFor(failure.Value), false);
        }

        var normalized = PasswordPolicy.Normalize(password);
        var answer = await pwned.CheckAsync(normalized, cancellationToken).ConfigureAwait(false);
        return answer switch
        {
            BreachCheckResult.Breached => new PasswordRulesResult(PasswordRulesStatus.Rejected, BreachedMessage, false),
            BreachCheckResult.Unavailable => WhenUnavailable(normalized, mode),
            _ => new PasswordRulesResult(PasswordRulesStatus.Accepted, null, false),
        };
    }

    private PasswordRulesResult WhenUnavailable(string normalized, BreachCheckMode mode)
    {
        if (mode == BreachCheckMode.FailClosed)
        {
            return new PasswordRulesResult(PasswordRulesStatus.CheckUnavailable, CheckUnavailableMessage, false);
        }

        return common.IsCommon(normalized)
            ? new PasswordRulesResult(PasswordRulesStatus.Rejected, TooCommonMessage, false)
            : new PasswordRulesResult(PasswordRulesStatus.Accepted, null, true);
    }
}

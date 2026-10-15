using Csps.Domain.Common;

namespace Csps.Application.Auth;

/// <summary>The error values the sign-in flow returns.</summary>
public static class AuthErrors
{
    /// <summary>The code of the one answer every failed sign-in gets (D-02).</summary>
    public const string InvalidCredentialsCode = "auth.invalid-credentials";

    /// <summary>The code of a request with missing or malformed fields.</summary>
    public const string ValidationCode = "auth.invalid-request";

    /// <summary>The plain-English text of the single failed-sign-in answer.</summary>
    public const string InvalidCredentialsMessage = "Email or password is incorrect.";

    /// <summary>The text above the field errors of a bad request.</summary>
    public const string ValidationMessage = "Check the highlighted fields.";

    /// <summary>The code of a missing, unknown, closed or timed-out pending sign-in.</summary>
    public const string TicketExpiredCode = "auth.ticket-expired";

    /// <summary>The plain-English text for a timed-out pending sign-in.</summary>
    public const string TicketExpiredMessage = "Your sign-in timed out. Sign in again.";

    /// <summary>The code of a cookie-reading call that failed the anti-CSRF check.</summary>
    public const string CsrfCheckFailedCode = "auth.csrf-check-failed";

    /// <summary>The plain-English text for a failed anti-CSRF check.</summary>
    public const string CsrfCheckFailedMessage = "This request could not be checked. Reload the page and try again.";

    /// <summary>Gets the answer for a missing, unknown, closed or timed-out pending sign-in; the page returns to sign-in.</summary>
    public static Error TicketExpired { get; } = Error.Unauthenticated(TicketExpiredCode, TicketExpiredMessage);

    /// <summary>Gets the answer for a cookie-reading call without the anti-CSRF header or from another origin.</summary>
    public static Error CsrfCheckFailed { get; } = Error.Forbidden(CsrfCheckFailedCode, CsrfCheckFailedMessage);

    /// <summary>Gets the one answer for an unknown email, wrong password, locked, deactivated, unconfirmed or passwordless account.</summary>
    public static Error InvalidCredentials { get; } = Error.Unauthenticated(InvalidCredentialsCode, InvalidCredentialsMessage);
}

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

    /// <summary>The code of a refresh or sign-in session that has ended or is unknown.</summary>
    public const string SessionEndedCode = "auth.session-ended";

    /// <summary>The plain-English text for a session that has ended.</summary>
    public const string SessionEndedMessage = "Your session ended. Sign in again.";

    /// <summary>The code of a session change that lost two races against other requests in a row.</summary>
    public const string SessionBusyCode = "auth.session-busy";

    /// <summary>The plain-English text of a session change that lost its races; nothing was changed.</summary>
    public const string SessionBusyMessage = "Something changed at the same time. Try again.";

    /// <summary>The code of a wrong emailed code.</summary>
    public const string CodeWrongCode = "auth.code-wrong";

    /// <summary>The plain-English text for a wrong emailed code.</summary>
    public const string CodeWrongMessage = "That code isn't right. Check the newest email and try again.";

    /// <summary>The code of an emailed code that has no tries left.</summary>
    public const string CodeUsedUpCode = "auth.code-used-up";

    /// <summary>The plain-English text for an emailed code that has no tries left.</summary>
    public const string CodeUsedUpMessage = "This code can't be used anymore. Use Resend Code to get a new one.";

    /// <summary>The code of an emailed code past its lifetime.</summary>
    public const string CodeExpiredCode = "auth.code-expired";

    /// <summary>The plain-English text for an emailed code past its lifetime.</summary>
    public const string CodeExpiredMessage = "This code has expired. Use Resend Code to get a new one.";

    /// <summary>The code of the account pause after too many wrong codes across sign-ins.</summary>
    public const string CodeLockoutCode = "auth.code-lockout";

    /// <summary>The plain-English text of the account pause after too many wrong codes.</summary>
    public const string CodeLockoutMessage = "Too many wrong codes.";

    /// <summary>The code of a resend asked for inside the cooldown.</summary>
    public const string ResendCooldownCode = "auth.resend-cooldown";

    /// <summary>The plain-English text of a resend asked for inside the cooldown.</summary>
    public const string ResendCooldownMessage = "Wait a moment before asking for another code.";

    /// <summary>The code of a resend refused by the hourly cap.</summary>
    public const string ResendCapCode = "auth.resend-cap";

    /// <summary>The plain-English text of a resend refused by the hourly cap; it names no wait time (D-10).</summary>
    public const string ResendCapMessage = "You've asked for too many codes.";

    /// <summary>The field that code errors belong to.</summary>
    public const string CodeField = "code";

    /// <summary>Gets the answer for a wrong emailed code.</summary>
    public static Error CodeWrong { get; } = CodeError(CodeWrongCode, CodeWrongMessage);

    /// <summary>Gets the answer for an emailed code with no tries left.</summary>
    public static Error CodeUsedUp { get; } = CodeError(CodeUsedUpCode, CodeUsedUpMessage);

    /// <summary>Gets the answer for an emailed code past its lifetime.</summary>
    public static Error CodeExpired { get; } = CodeError(CodeExpiredCode, CodeExpiredMessage);

    /// <summary>Gets the answer for the account pause after too many wrong codes; it gives no wait time.</summary>
    public static Error CodeLockout { get; } = Error.TooManyRequests(CodeLockoutCode, CodeLockoutMessage);

    /// <summary>Gets the answer for the hourly code cap. It carries no wait time, so no Retry-After is sent (D-10).</summary>
    public static Error ResendCap { get; } = Error.TooManyRequests(ResendCapCode, ResendCapMessage);

    /// <summary>Returns the answer for a resend asked for too soon.</summary>
    /// <param name="retryAfter">How long is left of the cooldown.</param>
    /// <returns>A 429 error that carries the wait.</returns>
    public static Error ResendCooldown(TimeSpan retryAfter) => Error.TooManyRequests(ResendCooldownCode, ResendCooldownMessage, retryAfter);

    /// <summary>Gets the answer for a missing, unknown, closed or timed-out pending sign-in; the page returns to sign-in.</summary>
    public static Error TicketExpired { get; } = Error.Unauthenticated(TicketExpiredCode, TicketExpiredMessage);

    /// <summary>Gets the answer for a session that has ended, is unknown or may no longer refresh; the client signs in again.</summary>
    public static Error SessionEnded { get; } = Error.Unauthenticated(SessionEndedCode, SessionEndedMessage);

    /// <summary>Gets the answer for a session change that lost two races in a row; nothing was changed, so the client retries.</summary>
    public static Error SessionBusy { get; } = Error.Conflict(SessionBusyCode, SessionBusyMessage);

    /// <summary>Gets the answer for a cookie-reading call without the anti-CSRF header or from another origin.</summary>
    public static Error CsrfCheckFailed { get; } = Error.Forbidden(CsrfCheckFailedCode, CsrfCheckFailedMessage);

    /// <summary>Gets the one answer for an unknown email, wrong password, locked, deactivated, unconfirmed or passwordless account.</summary>
    public static Error InvalidCredentials { get; } = Error.Unauthenticated(InvalidCredentialsCode, InvalidCredentialsMessage);

    // A code error is a 400 on the code field, so the page can show it under the boxes.
    private static Error CodeError(string code, string message) =>
        Error.Validation(code, message, new Dictionary<string, string[]> { [CodeField] = [message] });
}

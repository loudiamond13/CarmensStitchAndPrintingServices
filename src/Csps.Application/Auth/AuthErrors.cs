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

    /// <summary>Gets the one answer for an unknown email, wrong password, locked, deactivated, unconfirmed or passwordless account.</summary>
    public static Error InvalidCredentials { get; } = Error.Unauthenticated(InvalidCredentialsCode, InvalidCredentialsMessage);
}

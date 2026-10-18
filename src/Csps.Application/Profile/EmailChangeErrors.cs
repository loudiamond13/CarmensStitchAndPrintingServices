using Csps.Application.Auth;
using Csps.Domain.Common;

namespace Csps.Application.Profile;

/// <summary>The error values the email-change use cases return.</summary>
public static class EmailChangeErrors
{
    /// <summary>The code of a link that is malformed, unknown, used, replaced, expired or for an account that may not sign in.</summary>
    public const string InvalidCode = "email-change.invalid";

    /// <summary>The plain-English text for a link that does not work; it never says why.</summary>
    public const string InvalidMessage = "This link has expired";

    /// <summary>The field the new-address errors belong to.</summary>
    public const string NewEmailField = "newEmail";

    /// <summary>The text under the new-email field when another account that is not deleted already uses the address.</summary>
    public const string AddressTakenMessage = "Another account already uses this email.";

    /// <summary>Gets the one answer every dead email-change link gets (CWE-640).</summary>
    public static Error Invalid { get; } = Error.NotFound(InvalidCode, InvalidMessage);

    /// <summary>Gets the answer for a new address another account uses: a 400 on the new-email field.</summary>
    public static Error AddressTaken { get; } = Error.Validation(
        AuthErrors.ValidationCode,
        AuthErrors.ValidationMessage,
        new Dictionary<string, string[]> { [NewEmailField] = [AddressTakenMessage] });
}

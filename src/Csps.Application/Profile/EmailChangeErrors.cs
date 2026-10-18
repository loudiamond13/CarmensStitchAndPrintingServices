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

    /// <summary>The code of a link whose new address another account took before the link was used.</summary>
    public const string TakenCode = "email-change.taken";

    /// <summary>The plain-English text for a link whose new address was taken; it says only that the address cannot be used.</summary>
    public const string TakenMessage = "This email can't be used.";

    /// <summary>The code of a resend when no email change is waiting.</summary>
    public const string NoneCode = "email-change.none";

    /// <summary>The plain-English text when there is no email change to resend.</summary>
    public const string NoneMessage = "There is no email change waiting.";

    /// <summary>The field the new-address errors belong to.</summary>
    public const string NewEmailField = "newEmail";

    /// <summary>The text under the new-email field when another account that is not deleted already uses the address.</summary>
    public const string AddressTakenMessage = "Another account already uses this email.";

    /// <summary>Gets the one answer every dead email-change link gets (CWE-640).</summary>
    public static Error Invalid { get; } = Error.NotFound(InvalidCode, InvalidMessage);

    /// <summary>Gets the answer for a link whose new address another account took first: a 409 (D-24).</summary>
    public static Error Taken { get; } = Error.Conflict(TakenCode, TakenMessage);

    /// <summary>Gets the answer for a resend when nothing is pending: a 404.</summary>
    public static Error None { get; } = Error.NotFound(NoneCode, NoneMessage);

    /// <summary>Gets the answer for a new address another account uses: a 400 on the new-email field.</summary>
    public static Error AddressTaken { get; } = Error.Validation(
        AuthErrors.ValidationCode,
        AuthErrors.ValidationMessage,
        new Dictionary<string, string[]> { [NewEmailField] = [AddressTakenMessage] });
}

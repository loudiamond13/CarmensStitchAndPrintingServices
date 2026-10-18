using Csps.Domain.Common;

namespace Csps.Application.Profile;

/// <summary>The error values the email-change use cases return.</summary>
public static class EmailChangeErrors
{
    /// <summary>The code of a link that is malformed, unknown, used, replaced, expired or for an account that may not sign in.</summary>
    public const string InvalidCode = "email-change.invalid";

    /// <summary>The plain-English text for a link that does not work; it never says why.</summary>
    public const string InvalidMessage = "This link has expired";

    /// <summary>Gets the one answer every dead email-change link gets (CWE-640).</summary>
    public static Error Invalid { get; } = Error.NotFound(InvalidCode, InvalidMessage);
}

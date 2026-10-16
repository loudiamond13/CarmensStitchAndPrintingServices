namespace Csps.Application.Auth;

/// <summary>The body of a reset-link check: the token from the emailed link. It travels in the body, never in a URL.</summary>
/// <param name="Token">The 43-character token.</param>
public sealed record ResetTokenRequest(string? Token)
{
    /// <summary>Gets the request used when the body is empty or unreadable; it reads as an invalid link.</summary>
    public static ResetTokenRequest Empty { get; } = new((string?)null);

    /// <summary>Returns the type name only, so a token never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(ResetTokenRequest);
}

/// <summary>The answer to a usable reset link.</summary>
/// <param name="Email">The address of the account the link belongs to, so the page can name it.</param>
/// <param name="FirstName">The account given name, for the password rule.</param>
/// <param name="LastName">The account family name, for the password rule.</param>
public sealed record ResetLinkResponse(string Email, string FirstName, string LastName);

namespace Csps.Application.Profile;

/// <summary>The body of an email-change confirmation: the token from the emailed link. It travels in the body, never in a URL.</summary>
/// <param name="Token">The 43-character token.</param>
public sealed record EmailChangeTokenRequest(string? Token)
{
    /// <summary>Gets the request used when the body is empty or unreadable; it reads as an invalid link.</summary>
    public static EmailChangeTokenRequest Empty { get; } = new((string?)null);

    /// <summary>Returns the type name only, so a token never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(EmailChangeTokenRequest);
}

/// <summary>The answer to a confirmed email change.</summary>
/// <param name="NewEmail">The sign-in email from now on, so the page can name it.</param>
public sealed record EmailChangeResponse(string NewEmail);

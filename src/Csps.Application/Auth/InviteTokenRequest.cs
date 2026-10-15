namespace Csps.Application.Auth;

/// <summary>The body of an invite-link check: the token from the emailed link. It travels in the body, never in a URL.</summary>
/// <param name="Token">The 43-character token.</param>
public sealed record InviteTokenRequest(string? Token)
{
    /// <summary>Gets the request used when the body is empty or unreadable; it reads as an invalid invite.</summary>
    public static InviteTokenRequest Empty { get; } = new((string?)null);

    /// <summary>Returns the type name only, so a token never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(InviteTokenRequest);
}

/// <summary>The answer to a usable invite link.</summary>
/// <param name="Email">The address of the account the invite belongs to, so the page can name it.</param>
/// <param name="FirstName">The invited person's given name, for the greeting.</param>
public sealed record InviteLinkResponse(string Email, string FirstName);

namespace Csps.Application.Auth;

/// <summary>The accept-invite form: the token from the emailed link and the first password (D-29).</summary>
/// <param name="Token">The 43-character token from the link.</param>
/// <param name="NewPassword">The password as typed.</param>
public sealed record AcceptInviteRequest(string? Token, string? NewPassword)
{
    /// <summary>Gets the request used when the body is empty or unreadable.</summary>
    public static AcceptInviteRequest Empty { get; } = new(null, null);

    /// <summary>Returns the type name only, so a token or password never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(AcceptInviteRequest);
}

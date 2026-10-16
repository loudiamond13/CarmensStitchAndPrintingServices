namespace Csps.Application.Auth;

/// <summary>The signed-in user as the client sees it.</summary>
/// <param name="Id">The account id.</param>
/// <param name="Email">The sign-in email.</param>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Role">The role, <c>Admin</c> or <c>Manager</c>.</param>
public sealed record SessionUser(Guid Id, string Email, string FirstName, string LastName, string Role);

/// <summary>What a started or refreshed session hands to the client; the refresh token travels in a cookie, never here.</summary>
/// <param name="AccessToken">The 15-minute bearer token. A secret.</param>
/// <param name="AccessTokenExpiresAt">When the access token expires.</param>
/// <param name="SessionExpiresAt">The fixed end of the session.</param>
/// <param name="Persistent">True for "Keep me signed in".</param>
/// <param name="User">The signed-in user.</param>
public sealed record SessionResponse(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    DateTimeOffset SessionExpiresAt,
    bool Persistent,
    SessionUser User)
{
    /// <summary>Returns the type name only, so the token never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(SessionResponse);
}

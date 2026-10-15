namespace Csps.Application.Ports;

/// <summary>A signed access token and the instant it stops working.</summary>
/// <param name="Token">The compact JWT. A secret: never log it.</param>
/// <param name="ExpiresAt">When the token expires.</param>
public sealed record AccessToken(string Token, DateTimeOffset ExpiresAt)
{
    /// <summary>Returns the type name only, so the token never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(AccessToken);
}

/// <summary>Issues the short-lived bearer token of a session (AUTH-05).</summary>
public interface IAccessTokenIssuer
{
    /// <summary>Issues an access token that names the user, role and session.</summary>
    /// <param name="userId">The account.</param>
    /// <param name="role">The account's role.</param>
    /// <param name="sessionId">The session the token belongs to.</param>
    /// <returns>The token and its expiry.</returns>
    AccessToken Issue(Guid userId, string role, Guid sessionId);
}

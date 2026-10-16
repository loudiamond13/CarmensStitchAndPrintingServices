using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Server.Composition;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Csps.Server.Security;

/// <summary>
/// Issues the HS256 access token of a session with <see cref="JsonWebTokenHandler"/> (AUTH-05). The header type is
/// <c>at+jwt</c>, which the bearer validator requires, so no other JWT signed with the same key is accepted as an
/// access token (IN-04). Claims: <c>sub</c>, <c>role</c>, <c>sid</c> (the session) and <c>jti</c>.
/// </summary>
public sealed class AccessTokenIssuer : IAccessTokenIssuer
{
    /// <summary>The JWT header type of an access token (RFC 9068).</summary>
    public const string TokenType = "at+jwt";

    private readonly JsonWebTokenHandler _handler = new();
    private readonly SigningCredentials _credentials;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly TimeSpan _lifetime;
    private readonly TimeProvider _time;

    /// <summary>Creates the issuer from the validated JWT options.</summary>
    /// <param name="jwt">The issuer, audience and signing key.</param>
    /// <param name="settings">The auth settings (access token lifetime).</param>
    /// <param name="time">The clock.</param>
    /// <exception cref="InvalidOperationException">The signing key is not usable.</exception>
    public AccessTokenIssuer(IOptions<JwtOptions> jwt, AuthSettings settings, TimeProvider time)
    {
        ArgumentNullException.ThrowIfNull(jwt);
        ArgumentNullException.ThrowIfNull(settings);
        ArgumentNullException.ThrowIfNull(time);

        if (!jwt.Value.TryGetSigningKeyBytes(out var key))
        {
            throw new InvalidOperationException(JwtOptions.SigningKeyInvalidMessage);
        }

        _credentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256);
        _issuer = jwt.Value.Issuer;
        _audience = jwt.Value.Audience;
        _lifetime = settings.AccessTokenLifetime;
        _time = time;
    }

    /// <inheritdoc />
    public AccessToken Issue(Guid userId, string role, Guid sessionId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(role);

        var issuedAt = _time.GetUtcNow();
        var expiresAt = issuedAt.Add(_lifetime);
        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = _issuer,
            Audience = _audience,
            TokenType = TokenType,
            Claims = new Dictionary<string, object>
            {
                [SecurityRegistration.SubjectClaim] = userId.ToString("D"),
                [SecurityRegistration.RoleClaim] = role,
                [SecurityRegistration.SessionClaim] = sessionId.ToString("D"),
                ["jti"] = Guid.NewGuid().ToString("N"),
            },
            IssuedAt = issuedAt.UtcDateTime,
            NotBefore = issuedAt.UtcDateTime,
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = _credentials,
        });
        return new AccessToken(token, expiresAt);
    }
}

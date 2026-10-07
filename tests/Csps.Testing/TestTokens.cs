using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Csps.Testing;

/// <summary>
/// Mints real HS256 access tokens for tests with <see cref="JsonWebTokenHandler"/> (claims <c>sub</c> and
/// <c>role</c>). Token issuance for real users is Phase 4; the API only validates in Phase 1.
/// </summary>
public static class TestTokens
{
    /// <summary>The lifetime of a token when none is given.</summary>
    public static readonly TimeSpan DefaultLifetime = TimeSpan.FromMinutes(15);

    private static readonly JsonWebTokenHandler Handler = new();

    /// <summary>A valid token for <paramref name="role"/>, issued now by <paramref name="time"/>.</summary>
    /// <param name="role">The role claim, for example <c>Roles.Manager</c>.</param>
    /// <param name="time">The clock; use the one the API runs on.</param>
    /// <param name="userId">The <c>sub</c> claim; a new id when omitted.</param>
    /// <param name="lifetime">The lifetime; <see cref="DefaultLifetime"/> when omitted.</param>
    /// <returns>The compact JWT.</returns>
    public static string For(string role, TimeProvider time, Guid? userId = null, TimeSpan? lifetime = null)
    {
        ArgumentNullException.ThrowIfNull(time);
        return Create(role, time.GetUtcNow(), lifetime ?? DefaultLifetime, userId, TestJwt.Issuer, TestJwt.Audience, Sign(TestJwt.SigningKey()));
    }

    /// <summary>A correctly signed token that expired an hour ago, far beyond the 30-second clock skew.</summary>
    /// <param name="role">The role claim.</param>
    /// <returns>The compact JWT.</returns>
    public static string Expired(string role) =>
        Create(role, TimeProvider.System.GetUtcNow().AddHours(-2), TimeSpan.FromHours(1), null, TestJwt.Issuer, TestJwt.Audience, Sign(TestJwt.SigningKey()));

    /// <summary>An otherwise valid token signed with a key the API does not trust.</summary>
    /// <param name="role">The role claim.</param>
    /// <returns>The compact JWT.</returns>
    public static string SignedWithOtherKey(string role) =>
        Create(role, TimeProvider.System.GetUtcNow(), DefaultLifetime, null, TestJwt.Issuer, TestJwt.Audience, Sign(TestJwt.OtherKey()));

    /// <summary>An otherwise valid token with no signature (<c>"alg": "none"</c>).</summary>
    /// <param name="role">The role claim.</param>
    /// <returns>The compact JWT.</returns>
    public static string WithoutSignature(string role) =>
        Create(role, TimeProvider.System.GetUtcNow(), DefaultLifetime, null, TestJwt.Issuer, TestJwt.Audience, signingCredentials: null);

    /// <summary>A correctly signed token with the given issuer and audience.</summary>
    /// <param name="role">The role claim.</param>
    /// <param name="issuer">The <c>iss</c> claim.</param>
    /// <param name="audience">The <c>aud</c> claim.</param>
    /// <returns>The compact JWT.</returns>
    public static string WithIssuerAndAudience(string role, string issuer, string audience) =>
        Create(role, TimeProvider.System.GetUtcNow(), DefaultLifetime, null, issuer, audience, Sign(TestJwt.SigningKey()));

    private static SigningCredentials Sign(SecurityKey key) => new(key, SecurityAlgorithms.HmacSha256);

    private static string Create(
        string role,
        DateTimeOffset issuedAt,
        TimeSpan lifetime,
        Guid? userId,
        string issuer,
        string audience,
        SigningCredentials? signingCredentials)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(role);

        return Handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            Claims = new Dictionary<string, object>
            {
                ["sub"] = (userId ?? Guid.NewGuid()).ToString(),
                ["role"] = role,
            },
            NotBefore = issuedAt.UtcDateTime,
            IssuedAt = issuedAt.UtcDateTime,
            Expires = issuedAt.Add(lifetime).UtcDateTime,
            SigningCredentials = signingCredentials,
        });
    }
}

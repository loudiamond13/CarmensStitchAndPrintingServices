using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Csps.Server.Composition;

/// <summary>
/// Access-token validation and default-deny authorization (SEC-02, CWE-862/863, CWE-347/287). Tokens are issued by
/// <see cref="AccessTokenIssuer"/> and are accepted only while the session they name is active.
/// </summary>
public static class SecurityRegistration
{
    /// <summary>The claim that carries the user id; read raw because inbound claim mapping is off.</summary>
    public const string SubjectClaim = "sub";

    /// <summary>The claim that carries the role.</summary>
    public const string RoleClaim = "role";

    /// <summary>The claim that carries the session id; the session must be active on every request (AUTH-06).</summary>
    public const string SessionClaim = "sid";

    /// <summary>The clock skew allowed on token lifetimes.</summary>
    public static readonly TimeSpan ClockSkew = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Adds JwtBearer as the default scheme, configured lazily from <see cref="JwtOptions"/> (validated at startup),
    /// a fallback policy that requires an authenticated user, and the named <see cref="Policies"/>.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsSecurity(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddOptions<JwtOptions>()
            .BindConfiguration(JwtOptions.SectionName)
            .Validate(static options => !string.IsNullOrWhiteSpace(options.Issuer), JwtOptions.IssuerMissingMessage)
            .Validate(static options => !string.IsNullOrWhiteSpace(options.Audience), JwtOptions.AudienceMissingMessage)
            .Validate(static options => options.TryGetSigningKeyBytes(out _), JwtOptions.SigningKeyInvalidMessage)
            .ValidateOnStart();

        services.AddSingleton<IAccessTokenIssuer, AccessTokenIssuer>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtOptions>>(static (bearer, jwt) => ConfigureBearer(bearer, jwt.Value));

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
            .AddPolicy(Policies.Staff, static policy => policy.RequireAuthenticatedUser().RequireRole(Roles.Admin, Roles.Manager))
            .AddPolicy(Policies.Manager, static policy => policy.RequireAuthenticatedUser().RequireRole(Roles.Manager));

        return services;
    }

    private static void ConfigureBearer(JwtBearerOptions bearer, JwtOptions jwt)
    {
        if (!jwt.TryGetSigningKeyBytes(out var key))
        {
            throw new InvalidOperationException(JwtOptions.SigningKeyInvalidMessage);
        }

        // Claims keep their JWT names, so "sub" is the user id (HttpRequestContext) and "role" the role.
        bearer.MapInboundClaims = false;

        // The WWW-Authenticate header says only "Bearer": no hint why a token was rejected (CWE-209).
        bearer.IncludeErrorDetails = false;

        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            RequireSignedTokens = true,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],

            // Only access tokens: another JWT signed with the same key is refused (IN-04, CWE-347).
            ValidTypes = [AccessTokenIssuer.TokenType],
            RoleClaimType = RoleClaim,
            NameClaimType = SubjectClaim,
            ClockSkew = ClockSkew,
        };

        bearer.Events = new JwtBearerEvents { OnTokenValidated = RequireActiveSessionAsync };
    }

    // A valid signature is not enough: the sid must name an active session of the same user, on every request (AUTH-06).
    private static async Task RequireActiveSessionAsync(TokenValidatedContext context)
    {
        var principal = context.Principal;
        if (!Guid.TryParse(principal?.FindFirst(SubjectClaim)?.Value, out var userId)
            || !Guid.TryParse(principal?.FindFirst(SessionClaim)?.Value, out var sessionId))
        {
            context.Fail("The token does not name a user and a session.");
            return;
        }

        var sessions = context.HttpContext.RequestServices.GetRequiredService<ISessionCache>();
        if (!await sessions.IsActiveAsync(sessionId, userId, context.HttpContext.RequestAborted).ConfigureAwait(false))
        {
            context.Fail("The session is not active.");
        }
    }
}

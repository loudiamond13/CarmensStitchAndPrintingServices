using System.Collections.Frozen;
using Csps.Server.Composition;
using Csps.Server.IntegrationTests.Authorization;
using Csps.Server.Security;
using Microsoft.AspNetCore.Routing;

namespace Csps.Server.IntegrationTests.Idempotency;

/// <summary>One POST endpoint that is exempt from the Idempotency-Key gate, with the written reason.</summary>
/// <param name="Key">The endpoint key, <c>"POST {pattern}"</c>, as <see cref="AuthorizationCoverage.KeysOf"/> reports it.</param>
/// <param name="Reason">Why a repeat must not be stored and replayed; equals the reason on the endpoint's attribute.</param>
/// <param name="Decision">The decision the exemption comes from.</param>
public sealed record IdempotencyExemption(string Key, string Reason, string Decision);

/// <summary>
/// The written allow-list of POST endpoints that are exempt from the Idempotency-Key gate (SEC-06, D-40). Every other
/// POST is covered by default. An exempt endpoint carries <see cref="IdempotencyExemptAttribute"/> with the same
/// reason as its entry here, so an exemption is always a recorded decision. A later plan that adds an exempt POST adds
/// its entry: the set-new-password step in 04-21 and the invitation check in 04-22.
/// </summary>
public static class IdempotencyAllowList
{
    /// <summary>The decision every entry comes from.</summary>
    public const string Decision = "D-40";

    /// <summary>Gets the exempt endpoints present in this build.</summary>
    public static IReadOnlyList<IdempotencyExemption> Entries { get; } =
    [
        .. BaseEntries,
        .. TestingEntries,
    ];

    /// <summary>Gets the reason of each exempt endpoint, by endpoint key.</summary>
    public static IReadOnlyDictionary<string, string> ReasonsByKey { get; } =
        Entries.ToFrozenDictionary(static entry => entry.Key, static entry => entry.Reason, StringComparer.Ordinal);

    private static IdempotencyExemption[] BaseEntries =>
    [
        new("POST /api/v1/auth/sign-in", "Answers set a pending-login cookie and must never be stored; repeats are harmless and rate-limited.", Decision),
        new("POST /api/v1/auth/two-factor/verify", "The answer carries an access token and sets the refresh cookie; tokens must never be stored.", Decision),
        new("POST /api/v1/auth/two-factor/resend", "Bound to the ticket cookie; the 60 s cooldown and hourly cap already make a repeat harmless.", Decision),
        new("POST /api/v1/auth/refresh", "Returns a new access token and rotates the cookie; must never be stored or replayed.", Decision),
        new("POST /api/v1/auth/sign-out", "Naturally idempotent: a repeat finds nothing more to revoke; it clears the refresh cookie.", Decision),
        new("POST /api/v1/auth/sign-out-others", "Naturally idempotent: a repeat finds nothing more to revoke; no answer worth storing.", Decision),
        new("POST /api/v1/auth/password/reset/check", "Read-only lookup; changes nothing.", Decision),
        new("POST /api/v1/auth/invite/check", "Read-only lookup; changes nothing.", Decision),
        new("POST /api/v1/auth/password/set-new/check", "Read-only lookup; changes nothing.", Decision),
        new("POST /api/v1/auth/password/set-new", "The answer carries an access token and sets the refresh cookie; the pending ticket is single-use, so a repeat cannot set the password twice.", Decision),
    ];

    // The Testing-only staff fixture exists in Debug builds in the Testing environment only (QUAL-05).
    private static IdempotencyExemption[] TestingEntries => BuildFlavor.HasTestingFeatures
        ? [new("POST /api/testing/staff", "Testing-only test data, compiled out of Release.", Decision)]
        : [];
}

/// <summary>
/// The idempotency coverage rule (SEC-06, D-40) as a pure function, so it can be proven with synthetic endpoints. Each
/// POST endpoint is either covered (no exempt attribute and no allow-list entry) or exempt with a reason equal to its
/// entry; an entry that matches no POST endpoint fails.
/// </summary>
public static class IdempotencyCoverage
{
    private const string PostPrefix = "POST ";

    /// <summary>Lists every violation; an empty list means every POST is covered or written down.</summary>
    /// <param name="endpoints">The endpoints to check.</param>
    /// <param name="allowList">The allow-list: reason by endpoint key.</param>
    /// <returns>One plain-English line per violation.</returns>
    public static IReadOnlyList<string> FindViolations(IEnumerable<RouteEndpoint> endpoints, IReadOnlyDictionary<string, string> allowList)
    {
        ArgumentNullException.ThrowIfNull(endpoints);
        ArgumentNullException.ThrowIfNull(allowList);

        var violations = new List<string>();
        var postKeys = new HashSet<string>(StringComparer.Ordinal);

        foreach (var endpoint in endpoints)
        {
            var exempt = endpoint.Metadata.GetMetadata<IdempotencyExemptAttribute>();
            foreach (var key in AuthorizationCoverage.KeysOf(endpoint).Where(static key => key.StartsWith(PostPrefix, StringComparison.Ordinal)))
            {
                postKeys.Add(key);
                var listed = allowList.TryGetValue(key, out var listedReason);
                if (exempt is null && listed)
                {
                    violations.Add($"{key}: is on the allow-list but carries no [IdempotencyExempt].");
                }
                else if (exempt is not null && !listed)
                {
                    violations.Add($"{key}: is [IdempotencyExempt] but is not on the allow-list.");
                }
                else if (exempt is not null && !string.Equals(exempt.Reason, listedReason, StringComparison.Ordinal))
                {
                    violations.Add($"{key}: the reason on [IdempotencyExempt] differs from the allow-list reason.");
                }
            }
        }

        violations.AddRange(allowList.Keys
            .Where(key => !postKeys.Contains(key))
            .Order(StringComparer.Ordinal)
            .Select(static key => $"{key}: allow-list entry matches no POST endpoint."));

        return violations;
    }
}

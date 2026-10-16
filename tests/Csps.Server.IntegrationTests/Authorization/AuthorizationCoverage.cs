using System.Collections.Frozen;
using System.Reflection;
using Csps.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;

namespace Csps.Server.IntegrationTests.Authorization;

/// <summary>
/// The default-deny coverage rule (SEC-02, CWE-862/863), as a pure function so it can be proven with synthetic
/// endpoints. Each endpoint must be either anonymous and allow-listed, or carry a named policy that is one of the
/// <see cref="Policies"/> constants; each must have a matrix row; each matrix row must match an endpoint.
/// </summary>
public static class AuthorizationCoverage
{
    /// <summary>The method part of the key for an endpoint that matches every method.</summary>
    public const string AnyMethod = "*";

    /// <summary>The policy names an endpoint may use: the public string constants on <see cref="Policies"/>.</summary>
    public static IReadOnlySet<string> PolicyNames { get; } = typeof(Policies)
        .GetFields(BindingFlags.Public | BindingFlags.Static)
        .Where(static field => field.IsLiteral && field.FieldType == typeof(string))
        .Select(static field => (string)field.GetRawConstantValue()!)
        .ToFrozenSet(StringComparer.Ordinal);

    /// <summary>Returns the keys of an endpoint: <c>"{METHOD} {pattern}"</c> per method, or <c>"* {pattern}"</c>.</summary>
    /// <param name="endpoint">The endpoint.</param>
    /// <returns>One key per HTTP method the endpoint accepts.</returns>
    public static IReadOnlyList<string> KeysOf(RouteEndpoint endpoint)
    {
        ArgumentNullException.ThrowIfNull(endpoint);

        var raw = endpoint.RoutePattern.RawText ?? string.Empty;

        // Controller attribute routes report no leading slash; minimal endpoints and the SPA fallbacks ("{*path...}") do.
        var pattern = raw.StartsWith('/') || raw.StartsWith('{') ? raw : "/" + raw;
        var methods = endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods;
        return methods is null || methods.Count == 0
            ? [$"{AnyMethod} {pattern}"]
            : methods.Select(method => $"{method} {pattern}").ToList();
    }

    /// <summary>Lists every coverage violation; an empty list means the endpoints are fully covered.</summary>
    /// <param name="endpoints">The endpoints to check.</param>
    /// <param name="matrix">The authorization-matrix rows.</param>
    /// <param name="anonymousAllowList">The keys of the endpoints allowed to be anonymous.</param>
    /// <returns>One plain-English line per violation.</returns>
    public static IReadOnlyList<string> FindViolations(
        IEnumerable<RouteEndpoint> endpoints,
        IReadOnlyCollection<MatrixRow> matrix,
        IReadOnlySet<string> anonymousAllowList)
    {
        ArgumentNullException.ThrowIfNull(endpoints);
        ArgumentNullException.ThrowIfNull(matrix);
        ArgumentNullException.ThrowIfNull(anonymousAllowList);

        var violations = new List<string>();
        var matrixKeys = matrix.Select(static row => row.Key).ToHashSet(StringComparer.Ordinal);
        var discoveredKeys = new HashSet<string>(StringComparer.Ordinal);
        var anonymousKeys = new HashSet<string>(StringComparer.Ordinal);

        foreach (var endpoint in endpoints)
        {
            var isAnonymous = endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null;
            foreach (var key in KeysOf(endpoint))
            {
                discoveredKeys.Add(key);
                if (isAnonymous)
                {
                    anonymousKeys.Add(key);
                    if (!anonymousAllowList.Contains(key))
                    {
                        violations.Add($"{key}: allows anonymous callers but is not on the anonymous allow-list.");
                    }
                }
                else
                {
                    violations.AddRange(PolicyViolations(endpoint, key));
                }

                if (!matrixKeys.Contains(key))
                {
                    violations.Add($"{key}: has no authorization-matrix row.");
                }
            }
        }

        violations.AddRange(matrix
            .Where(row => !discoveredKeys.Contains(row.Key))
            .Select(static row => $"{row.Key}: matrix row matches no endpoint."));

        violations.AddRange(anonymousAllowList
            .Where(key => !anonymousKeys.Contains(key))
            .Order(StringComparer.Ordinal)
            .Select(static key => $"{key}: allow-list entry matches no anonymous endpoint."));

        return violations;
    }

    // An authenticated endpoint must name at least one policy, and every policy it names must be a Policies constant.
    // Without a name it would fall back to "any signed-in user", which is not a deliberate decision.
    private static IEnumerable<string> PolicyViolations(RouteEndpoint endpoint, string key)
    {
        var policies = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .Select(static data => data.Policy)
            .Where(static policy => !string.IsNullOrEmpty(policy))
            .Select(static policy => policy!)
            .ToList();

        if (policies.Count == 0)
        {
            yield return $"{key}: has no named authorization policy (use RequireAuthorization(Policies.X)).";
        }

        foreach (var unknown in policies.Where(policy => !PolicyNames.Contains(policy)))
        {
            yield return $"{key}: policy '{unknown}' is not a Csps.Application.Security.Policies constant.";
        }
    }
}

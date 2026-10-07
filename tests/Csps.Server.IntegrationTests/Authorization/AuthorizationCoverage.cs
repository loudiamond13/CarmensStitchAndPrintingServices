using System.Collections.Frozen;
using System.Reflection;
using Csps.Application.Security;
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

        var pattern = endpoint.RoutePattern.RawText ?? string.Empty;
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

        // RED stub (01-08 Task 2): the rule is implemented in the GREEN commit.
        return [];
    }
}

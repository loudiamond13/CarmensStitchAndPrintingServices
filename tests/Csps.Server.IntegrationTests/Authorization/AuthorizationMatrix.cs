using System.Collections.Frozen;
using Csps.Server.Composition;

namespace Csps.Server.IntegrationTests.Authorization;

/// <summary>Who calls an endpoint in the authorization matrix.</summary>
public enum Caller
{
    /// <summary>No Authorization header.</summary>
    Anonymous,

    /// <summary>A valid access token with the Admin role.</summary>
    Admin,

    /// <summary>A valid access token with the Manager role.</summary>
    Manager,
}

/// <summary>One endpoint of the authorization matrix and the exact status each caller must get.</summary>
/// <param name="Method">The HTTP method, or <c>*</c> for an endpoint that matches every method.</param>
/// <param name="RoutePattern">The endpoint's raw route pattern, exactly as routing reports it.</param>
/// <param name="SamplePath">A concrete path that reaches the endpoint.</param>
/// <param name="Anonymous">The status for an anonymous caller.</param>
/// <param name="Admin">The status for an Admin.</param>
/// <param name="Manager">The status for a Manager.</param>
public sealed record MatrixRow(string Method, string RoutePattern, string SamplePath, int Anonymous, int Admin, int Manager)
{
    /// <summary>The endpoint key, <c>"{METHOD|*} {RoutePattern}"</c>, that matches <see cref="AuthorizationCoverage.KeysOf"/>.</summary>
    public string Key => $"{Method} {RoutePattern}";

    /// <summary>The method to send: GET for a <c>*</c> row.</summary>
    public HttpMethod RequestMethod => Method == AuthorizationCoverage.AnyMethod ? HttpMethod.Get : new HttpMethod(Method);

    /// <summary>Returns the status <paramref name="caller"/> must get.</summary>
    /// <param name="caller">The caller.</param>
    /// <returns>The expected HTTP status code.</returns>
    public int ExpectedFor(Caller caller) => caller switch
    {
        Caller.Anonymous => Anonymous,
        Caller.Admin => Admin,
        Caller.Manager => Manager,
        _ => throw new ArgumentOutOfRangeException(nameof(caller), caller, "Unknown caller."),
    };
}

/// <summary>
/// The checked-in authorization matrix (SEC-02). Every endpoint the API maps needs a row here, and every anonymous
/// endpoint needs an allow-list entry, or <see cref="AuthorizationMatrixTests"/> fails the build's test run.
/// When you add an endpoint, add its row with the exact status for each caller.
/// </summary>
public static class AuthorizationMatrix
{
    /// <summary>The matrix rows.</summary>
    public static IReadOnlyList<MatrixRow> Rows { get; } =
    [
        .. BaseRows,
        .. TestingRows,
    ];

    // The Testing-only routes exist in Debug builds in the Testing environment only (QUAL-05); a Release run has no such rows.
    // POST /api/testing/staff gets no body here, so every caller meets the same 400.
    private static MatrixRow[] TestingRows => BuildFlavor.HasTestingFeatures
        ?
        [
            new("GET", "/api/testing/emails", "/api/testing/emails", Anonymous: 200, Admin: 200, Manager: 200),
            new("POST", "/api/testing/staff", "/api/testing/staff", Anonymous: 400, Admin: 400, Manager: 400),
        ]
        : [];

    private static MatrixRow[] BaseRows =>
    [
        // /health answers GET and HEAD only, so it has two keys like the SPA shell. Other methods: HealthEndpointTests.
        new("GET", "/health", "/health", Anonymous: 200, Admin: 200, Manager: 200),
        new("HEAD", "/health", "/health", Anonymous: 200, Admin: 200, Manager: 200),
        new("*", "/api/{**path}", "/api/v1/does-not-exist", Anonymous: 404, Admin: 404, Manager: 404),
        new("GET", "/api/v1/site-settings", "/api/v1/site-settings", Anonymous: 401, Admin: 200, Manager: 200),
        // Sign-in is anonymous; with no body every caller meets the same 400 field errors (the token is ignored).
        new("POST", "/api/v1/auth/sign-in", "/api/v1/auth/sign-in", Anonymous: 400, Admin: 400, Manager: 400),
        // The code step reads the ticket cookie; with no cookie every caller meets the same 401 (the token is ignored).
        new("POST", "/api/v1/auth/two-factor/verify", "/api/v1/auth/two-factor/verify", Anonymous: 401, Admin: 401, Manager: 401),
        new("POST", "/api/v1/auth/two-factor/resend", "/api/v1/auth/two-factor/resend", Anonymous: 401, Admin: 401, Manager: 401),
        // Refresh reads the refresh cookie; with no cookie every caller meets the same 401 (the token is ignored).
        new("POST", "/api/v1/auth/refresh", "/api/v1/auth/refresh", Anonymous: 401, Admin: 401, Manager: 401),

        // The SPA shell (WEB-01). MapFallbackToFile registers GET and HEAD only, so the shell has two keys.
        new("GET", "{*path:nonfile}", "/", Anonymous: 200, Admin: 200, Manager: 200),
        new("HEAD", "{*path:nonfile}", "/products", Anonymous: 200, Admin: 200, Manager: 200),

        // A missing file is a 404 for everyone (research Pitfall 11). The matrix host runs in the Testing environment,
        // not Development, so the two reserved API-doc prefixes are mapped as 404 fallbacks too (D-29).
        new("*", "{*path:file}", "/missing.js", Anonymous: 404, Admin: 404, Manager: 404),
        new("*", "/openapi/{**path}", "/openapi/v1.json", Anonymous: 404, Admin: 404, Manager: 404),
        new("*", "/scalar/{**path}", "/scalar", Anonymous: 404, Admin: 404, Manager: 404),
    ];

    /// <summary>The only endpoints allowed to be anonymous, by key.</summary>
    public static IReadOnlySet<string> AnonymousAllowList { get; } =
        new[]
        {
            "GET /health",
            "HEAD /health",
            "POST /api/v1/auth/sign-in",
            "POST /api/v1/auth/two-factor/verify",
            "POST /api/v1/auth/two-factor/resend",
            "POST /api/v1/auth/refresh",
            "* /api/{**path}",
            "GET {*path:nonfile}",
            "HEAD {*path:nonfile}",
            "* {*path:file}",
            "* /openapi/{**path}",
            "* /scalar/{**path}",
        }.Concat(TestingAnonymousKeys).ToFrozenSet(StringComparer.Ordinal);

    private static string[] TestingAnonymousKeys => BuildFlavor.HasTestingFeatures ? ["GET /api/testing/emails", "POST /api/testing/staff"] : [];

    /// <summary>Returns the row with the given key.</summary>
    /// <param name="key">The endpoint key.</param>
    /// <returns>The row.</returns>
    public static MatrixRow Row(string key) => Rows.Single(row => string.Equals(row.Key, key, StringComparison.Ordinal));
}

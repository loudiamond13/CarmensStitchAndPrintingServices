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
        // Sign-out is anonymous and always succeeds, with or without a cookie. Sign-out-others needs a Staff token; the matrix
        // sessions have no other device, so staff get 204.
        new("POST", "/api/v1/auth/sign-out", "/api/v1/auth/sign-out", Anonymous: 204, Admin: 204, Manager: 204),
        new("POST", "/api/v1/auth/sign-out-others", "/api/v1/auth/sign-out-others", Anonymous: 401, Admin: 204, Manager: 204),
        // Forgot-password is anonymous; with no body every caller meets the same 400 field errors (the token is ignored).
        new("POST", "/api/v1/auth/password/forgot", "/api/v1/auth/password/forgot", Anonymous: 400, Admin: 400, Manager: 400),
        // Reset is anonymous too. With no body the check meets the invalid-link 404 and the reset the missing-password 400.
        new("POST", "/api/v1/auth/password/reset/check", "/api/v1/auth/password/reset/check", Anonymous: 404, Admin: 404, Manager: 404),
        new("POST", "/api/v1/auth/password/reset", "/api/v1/auth/password/reset", Anonymous: 400, Admin: 400, Manager: 400),
        // The must-change step reads the ticket cookie; with no cookie every caller meets the same 401 (the token is ignored).
        new("POST", "/api/v1/auth/password/set-new", "/api/v1/auth/password/set-new", Anonymous: 401, Admin: 401, Manager: 401),
        new("POST", "/api/v1/auth/password/set-new/check", "/api/v1/auth/password/set-new/check", Anonymous: 401, Admin: 401, Manager: 401),
        // Invites are anonymous. With no body the check meets the invalid-invite 404 and the accept the missing-password 400.
        new("POST", "/api/v1/auth/invite/check", "/api/v1/auth/invite/check", Anonymous: 404, Admin: 404, Manager: 404),
        new("POST", "/api/v1/auth/invite/accept", "/api/v1/auth/invite/accept", Anonymous: 400, Admin: 400, Manager: 400),
        // The caller's own signed-in devices (D-43): Staff only.
        new("GET", "/api/v1/sessions", "/api/v1/sessions", Anonymous: 401, Admin: 200, Manager: 200),
        // A random id is no session of the caller, so staff meet the same 404 whatever their role (CWE-639).
        new("DELETE", "/api/v1/sessions/{id:guid}", "/api/v1/sessions/6f1d3c52-8a0e-4b7d-9c41-2e5a7b9d0f13", Anonymous: 401, Admin: 404, Manager: 404),

        // The caller's own profile (PROF-01): Staff only, no id in the route. A PUT with no body meets the same 400 field errors.
        new("GET", "/api/v1/profile", "/api/v1/profile", Anonymous: 401, Admin: 200, Manager: 200),
        new("PUT", "/api/v1/profile", "/api/v1/profile", Anonymous: 401, Admin: 400, Manager: 400),
        // Changing the password (PROF-03): Staff only. With no body both roles meet the same 400 field errors; the idempotency gate runs after authorization.
        new("POST", "/api/v1/profile/password", "/api/v1/profile/password", Anonymous: 401, Admin: 400, Manager: 400),
        // Asking to change the sign-in email (PROF-02): Staff only. With no body both roles meet the same 400 field errors.
        new("POST", "/api/v1/profile/email-change", "/api/v1/profile/email-change", Anonymous: 401, Admin: 400, Manager: 400),
        // Confirming it is anonymous (the emailed link is the proof). With no body every caller meets the same invalid-link 404; the session is ignored.
        new("POST", "/api/v1/profile/email-change/confirm", "/api/v1/profile/email-change/confirm", Anonymous: 404, Admin: 404, Manager: 404),
        // The read-only link check is anonymous too, and answers the same invalid-link 404 for a missing token whoever asks.
        new("POST", "/api/v1/profile/email-change/check", "/api/v1/profile/email-change/check", Anonymous: 404, Admin: 404, Manager: 404),
        // Sending the link again (D-24): Staff only. A caller with nothing waiting meets the same 404 email-change.none.
        new("POST", "/api/v1/profile/email-change/resend", "/api/v1/profile/email-change/resend", Anonymous: 401, Admin: 404, Manager: 404),
        // Calling the change off is naturally idempotent: with nothing waiting both roles still get 204.
        new("DELETE", "/api/v1/profile/email-change", "/api/v1/profile/email-change", Anonymous: 401, Admin: 204, Manager: 204),

        // The staff roster (USER-01, USER-08): Managers only, so an Admin meets 403.
        new("GET", "/api/v1/users", "/api/v1/users", Anonymous: 401, Admin: 403, Manager: 200),
        // A random id is no one, so a Manager meets 404 users.not-found; an Admin never gets that far.
        new("GET", "/api/v1/users/{id:guid}", "/api/v1/users/3d9b7a14-5c2e-4f08-a6d1-7e0b9c4f2a85", Anonymous: 401, Admin: 403, Manager: 404),
        // Adding a person (USER-02): Managers only. With no body a Manager meets the 400 field errors; an Admin never gets that far.
        new("POST", "/api/v1/users", "/api/v1/users", Anonymous: 401, Admin: 403, Manager: 400),

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
            "POST /api/v1/auth/sign-out",
            "POST /api/v1/auth/password/forgot",
            "POST /api/v1/auth/password/reset/check",
            "POST /api/v1/auth/password/reset",
            "POST /api/v1/auth/password/set-new",
            "POST /api/v1/auth/password/set-new/check",
            "POST /api/v1/auth/invite/check",
            "POST /api/v1/auth/invite/accept",
            "POST /api/v1/profile/email-change/confirm",
            "POST /api/v1/profile/email-change/check",
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

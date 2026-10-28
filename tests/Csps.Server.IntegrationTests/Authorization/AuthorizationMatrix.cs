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
    // POST /api/testing/staff and POST /api/testing/expenses get no body here, so every caller meets the same 400.
    private static MatrixRow[] TestingRows => BuildFlavor.HasTestingFeatures
        ?
        [
            new("GET", "/api/testing/emails", "/api/testing/emails", Anonymous: 200, Admin: 200, Manager: 200),
            new("POST", "/api/testing/staff", "/api/testing/staff", Anonymous: 400, Admin: 400, Manager: 400),
            new("POST", "/api/testing/expenses", "/api/testing/expenses", Anonymous: 400, Admin: 400, Manager: 400),
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
        // Editing another person (USER-03): Managers only. A random id with no body meets the same 400 field errors.
        new("PUT", "/api/v1/users/{id:guid}", "/api/v1/users/c2f6a8d3-91b4-47e5-8d0a-6b3e7f1c4a92", Anonymous: 401, Admin: 403, Manager: 400),
        // Calling off a waiting email change (USER-03, C-9): Managers only. A random id is no one, so a Manager meets 404 users.not-found.
        new("DELETE", "/api/v1/users/{id:guid}/email-change", "/api/v1/users/e4b1d7a2-3c58-49f6-9a0e-5d2c8f1b6e37/email-change", Anonymous: 401, Admin: 403, Manager: 404),
        // Deactivating and reactivating (USER-03): Managers only. A random id is no one, so a Manager meets 404 users.not-found.
        new("POST", "/api/v1/users/{id:guid}/deactivate", "/api/v1/users/5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24/deactivate", Anonymous: 401, Admin: 403, Manager: 404),
        new("POST", "/api/v1/users/{id:guid}/activate", "/api/v1/users/9c4a1e58-7f2b-4d63-b0a9-3e8d5c2f1a76/activate", Anonymous: 401, Admin: 403, Manager: 404),
        // Locking and unlocking (USER-03, D-16): Managers only. A random id is no one, so a Manager meets 404 users.not-found.
        new("POST", "/api/v1/users/{id:guid}/lock", "/api/v1/users/a7d3f512-6e08-4b9c-95a1-2c4e8b0d7f36/lock", Anonymous: 401, Admin: 403, Manager: 404),
        new("POST", "/api/v1/users/{id:guid}/unlock", "/api/v1/users/3e9c5a07-d184-4f2b-8a63-b1f0c7d2e945/unlock", Anonymous: 401, Admin: 403, Manager: 404),
        // Sending an invitation again (USER-07): Managers only. A random id is no one, so a Manager meets 404 users.not-found.
        new("POST", "/api/v1/users/{id:guid}/resend-invitation", "/api/v1/users/b2c8e471-0d95-4a36-8f1e-7a5d3c9b6e20/resend-invitation", Anonymous: 401, Admin: 403, Manager: 404),
        // Emailing a reset link (USER-07): Managers only. A random id is no one, so a Manager meets 404 users.not-found.
        new("POST", "/api/v1/users/{id:guid}/send-reset-link", "/api/v1/users/d5a9c3e8-2b74-4f10-9e6d-8c1f0a7b3e45/send-reset-link", Anonymous: 401, Admin: 403, Manager: 404),
        // Setting a temporary password (C-4): Managers only. With no body the password is missing, so a Manager meets 400 before the person is looked up.
        new("POST", "/api/v1/users/{id:guid}/temporary-password", "/api/v1/users/f1b6d2a9-5e83-4c07-b4a1-9d0e7c3a8f52/temporary-password", Anonymous: 401, Admin: 403, Manager: 400),
        // Deleting (USER-03, D-07): Managers only. A random id is no one, so a Manager meets 404 users.not-found.
        new("DELETE", "/api/v1/users/{id:guid}", "/api/v1/users/6f1d9b34-82c7-4e05-a3b8-d4c20e7a5f19", Anonymous: 401, Admin: 403, Manager: 404),

        // The audit log viewer (AUDIT-02, D-26): Managers only, so an Admin meets 403. Read only; there is no export (D-29).
        new("GET", "/api/v1/audit-log", "/api/v1/audit-log", Anonymous: 401, Admin: 403, Manager: 200),
        new("GET", "/api/v1/audit-log/people", "/api/v1/audit-log/people", Anonymous: 401, Admin: 403, Manager: 200),

        // The order lists (D-16, D-17, D-18, D-19): Staff only, both roles read them.
        new("GET", "/api/v1/product-types", "/api/v1/product-types", Anonymous: 401, Admin: 200, Manager: 200),
        new("GET", "/api/v1/payment-methods", "/api/v1/payment-methods", Anonymous: 401, Admin: 200, Manager: 200),
        new("GET", "/api/v1/order-expense-categories", "/api/v1/order-expense-categories", Anonymous: 401, Admin: 200, Manager: 200),

        // The expense category list (D-08, D-15): Staff only, both roles read it.
        new("GET", "/api/v1/expense-categories", "/api/v1/expense-categories", Anonymous: 401, Admin: 200, Manager: 200),
        // Adding a category (CEXP-02, D-08, D-14): Managers only, so an Admin meets 403. With no body a Manager meets the 400 field errors.
        new("POST", "/api/v1/expense-categories", "/api/v1/expense-categories", Anonymous: 401, Admin: 403, Manager: 400),
        // Reading one category (CEXP-02, D-14): Managers only. A fresh random id is no category, so a Manager meets 404 expense-categories.not-found.
        new("GET", "/api/v1/expense-categories/{id:guid}", "/api/v1/expense-categories/3b7d1e94-6c25-4a80-9f13-8e0a5c2d7b61", Anonymous: 401, Admin: 403, Manager: 404),
        // Renaming or recoloring a category (CEXP-02, D-12, D-13): Managers only. With no body a Manager meets the 400 field errors.
        new("PUT", "/api/v1/expense-categories/{id:guid}", "/api/v1/expense-categories/8e4a2c07-1d59-4b36-a6f8-5c9e3b1d7a42", Anonymous: 401, Admin: 403, Manager: 400),
        // Retiring and bringing back a category (CEXP-02, D-11, OQ-4): Managers only. The matrix sends an Idempotency-Key, so a fresh random id is no category and a Manager meets 404 expense-categories.not-found; a missing key is 400 after authorization (covered in ExpenseCategoriesManagementTests).
        new("POST", "/api/v1/expense-categories/{id:guid}/retire", "/api/v1/expense-categories/5a9c3e71-2b84-4d06-8f1a-7c0e6d4b9a23/retire", Anonymous: 401, Admin: 403, Manager: 404),
        new("POST", "/api/v1/expense-categories/{id:guid}/reactivate", "/api/v1/expense-categories/e1b6d4a8-7f32-4c59-9a0d-3b8f5e2c6d17/reactivate", Anonymous: 401, Admin: 403, Manager: 404),
        // Deleting a never-used category (CEXP-02, D-10, D-30): Managers only. A fresh random id is no category, so a Manager meets 404 expense-categories.not-found.
        new("DELETE", "/api/v1/expense-categories/{id:guid}", "/api/v1/expense-categories/c9f2a5d3-8e14-4b67-a0c1-6d3b7e9f2a58", Anonymous: 401, Admin: 403, Manager: 404),
        // The staff who can be named as the payer (CEXP-05, D-32): Staff only, names and ids only.
        new("GET", "/api/v1/staff", "/api/v1/staff", Anonymous: 401, Admin: 200, Manager: 200),

        // Recording a company expense (CEXP-02): Staff only. With no body both roles meet the same 400 field errors.
        new("POST", "/api/v1/company-expenses", "/api/v1/company-expenses", Anonymous: 401, Admin: 400, Manager: 400),
        // Listing company expenses (CEXP-01, D-25): both roles read every expense. The sample path carries a query so the list handler runs end to end.
        new("GET", "/api/v1/company-expenses", "/api/v1/company-expenses?pageSize=1", Anonymous: 401, Admin: 200, Manager: 200),
        // The month KPIs (CEXP-03, D-25): both roles read the same figures, and the route takes no input.
        new("GET", "/api/v1/company-expenses/kpis", "/api/v1/company-expenses/kpis", Anonymous: 401, Admin: 200, Manager: 200),
        // Reading one expense (CEXP-02, D-25): both roles read every expense. A random id is no expense, so both meet 404 company-expenses.not-found.
        new("GET", "/api/v1/company-expenses/{id:guid}", "/api/v1/company-expenses/9a3e6c15-4b72-4d08-b1f9-0c8d5e7a2f64", Anonymous: 401, Admin: 404, Manager: 404),
        // Editing one expense (CEXP-02, SEC-07): a fresh random id and no body, so a caller who passes the policy meets 400 field errors before any lookup.
        new("PUT", "/api/v1/company-expenses/{id:guid}", "/api/v1/company-expenses/6e2f8a14-9c05-4b3d-a7e1-3d5b9f1c8a20", Anonymous: 401, Admin: 400, Manager: 400),
        // Deleting an expense (CEXP-02, D-01, D-02): Managers only, so an Admin meets 403. A fresh random id is no expense, so a Manager meets 404 company-expenses.not-found.
        new("DELETE", "/api/v1/company-expenses/{id:guid}", "/api/v1/company-expenses/b4d7e1a9-2f63-4c80-9a15-7e3c0d8b6f42", Anonymous: 401, Admin: 403, Manager: 404),
        // The deleted list (CEXP-02, D-07): Managers only, so an Admin meets 403.
        new("GET", "/api/v1/company-expenses/deleted", "/api/v1/company-expenses/deleted", Anonymous: 401, Admin: 403, Manager: 200),
        // Restoring (CEXP-02, D-03): Managers only. The matrix sends an Idempotency-Key, so a fresh random id is no expense and a Manager meets 404 company-expenses.not-found; a missing key is 400 after authorization (covered in CompanyExpenseDeletionTests).
        new("POST", "/api/v1/company-expenses/{id:guid}/restore", "/api/v1/company-expenses/c5e8f2b0-3a74-4d91-8b26-8f4d1e9c7a53/restore", Anonymous: 401, Admin: 403, Manager: 404),
        // Deleting for good (CEXP-02, D-04): Managers only. A fresh random id is no expense, so a Manager meets 404 company-expenses.not-found.
        new("DELETE", "/api/v1/company-expenses/{id:guid}/permanent", "/api/v1/company-expenses/d7a1b9e3-5c28-4f60-a4d2-1b8e6f3c0a95/permanent", Anonymous: 401, Admin: 403, Manager: 404),

        // Creating an order (ORD-03): Staff only. The matrix sends an Idempotency-Key and no body, so both roles meet 400 orders.invalid-request.
        new("POST", "/api/v1/orders", "/api/v1/orders", Anonymous: 401, Admin: 400, Manager: 400),
        // Reading one order (ORD-03): both roles. A fresh random id is no order, so both meet 404 orders.not-found.
        new("GET", "/api/v1/orders/{id:guid}", "/api/v1/orders/3f7a2c91-6d48-4e15-b0a3-9c1e5d8f2b64", Anonymous: 401, Admin: 404, Manager: 404),

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

    private static string[] TestingAnonymousKeys => BuildFlavor.HasTestingFeatures ? ["GET /api/testing/emails", "POST /api/testing/staff", "POST /api/testing/expenses"] : [];

    /// <summary>Returns the row with the given key.</summary>
    /// <param name="key">The endpoint key.</param>
    /// <returns>The row.</returns>
    public static MatrixRow Row(string key) => Rows.Single(row => string.Equals(row.Key, key, StringComparison.Ordinal));
}

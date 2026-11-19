using Csps.Server.Security;

namespace Csps.Server.Http;

/// <summary>
/// Expires the two retired analytics cookies (the Phase 12 consent cookie and visitor id) on the answer to any request that still carries
/// them, so the site truthfully sets no optional cookie (D-63). The delete uses the options each cookie was set with: a browser removes a
/// cookie only when name, path and domain match, and refuses a <c>__Host-</c> or <c>__Secure-</c> delete without <c>Secure</c>.
/// Registered after the static files, so long-cached assets never carry a Set-Cookie. No other cookie is touched.
/// </summary>
/// <param name="next">The next middleware.</param>
public sealed class RetiredCookiesMiddleware(RequestDelegate next)
{
    /// <summary>Looks for the retired cookies once and, only when the browser sent one, registers the delete for the answer.</summary>
    /// <param name="context">The current HTTP context.</param>
    /// <returns>A task that completes when the rest of the pipeline has run.</returns>
    public Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var cookies = context.Request.Cookies;
        var consent = cookies.ContainsKey(AnalyticsCookies.ConsentCookieName);
        var visitor = cookies.ContainsKey(AnalyticsCookies.VisitorCookieName);
        if (consent || visitor)
        {
            context.Response.OnStarting(static state => Expire((Pending)state), new Pending(context, consent, visitor));
        }

        return next(context);
    }

    private static Task Expire(Pending pending)
    {
        var cookies = pending.Context.Response.Cookies;
        if (pending.Consent)
        {
            cookies.Delete(AnalyticsCookies.ConsentCookieName, new CookieOptions
            {
                HttpOnly = false,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Path = "/",
            });
        }

        if (pending.Visitor)
        {
            cookies.Delete(AnalyticsCookies.VisitorCookieName, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Path = AnalyticsCookies.CookiePath,
            });
        }

        return Task.CompletedTask;
    }

    private sealed record Pending(HttpContext Context, bool Consent, bool Visitor);
}

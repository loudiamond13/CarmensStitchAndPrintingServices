using Csps.Application.Auth;
using Csps.Domain.Common;
using Csps.Server.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Csps.Server.Security;

/// <summary>
/// Guards an action that reads an auth cookie against cross-site requests (AUTH-05, CWE-352): the call must carry
/// <c>X-CSPS-CSRF: 1</c>, which a cross-origin page cannot add without a CORS preflight the API never allows, and a
/// <c>Sec-Fetch-Site</c> header, when the browser sends one, must say <c>same-origin</c>. This is on top of the
/// SameSite=Strict cookies. A failed check is a 403 <c>auth.csrf-check-failed</c> and the action never runs.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RequireCsrfHeaderAttribute : Attribute, IAsyncAuthorizationFilter
{
    /// <summary>The request header the web client sends on every cookie-reading call.</summary>
    public const string HeaderName = "X-CSPS-CSRF";

    private const string HeaderValue = "1";
    private const string FetchSiteHeader = "Sec-Fetch-Site";
    private const string SameOrigin = "same-origin";

    /// <inheritdoc />
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var headers = context.HttpContext.Request.Headers;
        var marked = headers[HeaderName].ToString() == HeaderValue;
        var fetchSite = headers[FetchSiteHeader];
        var sameOrigin = fetchSite.Count == 0 || fetchSite.ToString() == SameOrigin;
        if (marked && sameOrigin)
        {
            return;
        }

        var refusal = Result.Failure(AuthErrors.CsrfCheckFailed).ToHttpResult(context.HttpContext, static () => Results.NoContent());
        await refusal.ExecuteAsync(context.HttpContext).ConfigureAwait(false);
        context.Result = new EmptyResult();
    }
}

using Csps.Server.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Csps.Server.Endpoints;

/// <summary>Routing rules shared by every API endpoint.</summary>
public static class ApiRouting
{
    /// <summary>
    /// The catch-all under <c>/api</c>. It is a pattern fallback, so <c>/api</c>, <c>/api/</c> and file-like paths
    /// such as <c>/api/v1/nope.json</c> all match. It matches every method, so a wrong method on a known API route
    /// also answers 404 rather than 405 (research A4).
    /// </summary>
    public const string FallbackPattern = "/api/{**path}";

    /// <summary>
    /// Maps the anonymous <c>/api</c> fallback: any request under <c>/api</c> that matches no endpoint gets a
    /// ProblemDetails 404 and never falls through to a page (FND-05).
    /// </summary>
    /// <param name="endpoints">The endpoint route builder.</param>
    /// <returns>The convention builder for further configuration.</returns>
    public static IEndpointConventionBuilder MapApiFallback(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        return endpoints
            .MapFallback(FallbackPattern, ApiNotFound)
            .AllowAnonymous()
            .ExcludeFromDescription();
    }

    private static ProblemHttpResult ApiNotFound(HttpContext context) =>
        TypedResults.Problem(CspsProblemDetails.Build(context, StatusCodes.Status404NotFound));
}

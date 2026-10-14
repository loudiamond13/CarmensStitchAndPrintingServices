using Csps.Server.Http;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

namespace Csps.Server.Endpoints;

/// <summary>Maps the public, anonymous <c>/health</c> endpoint (FND-06, D-23).</summary>
public static class HealthEndpoint
{
    /// <summary>The route the health endpoint answers on.</summary>
    public const string Route = "/health";

    /// <summary>
    /// Maps <c>GET</c> and <c>HEAD /health</c> with the minimal response writer and anonymous access.
    /// <c>MapHealthChecks</c> alone would run the checks for every method. With the method metadata, any other
    /// method matches no endpoint and gets the same answer as any unserved request: 401 for an anonymous caller
    /// (default deny) and 404 for a signed-in one. It is not 405, because the any-method missing-file fallback shares
    /// the routing node (research A4).
    /// </summary>
    /// <param name="endpoints">The endpoint route builder.</param>
    /// <returns>The convention builder for further configuration.</returns>
    public static IEndpointConventionBuilder MapCspsHealth(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        return endpoints
            .MapHealthChecks(Route, new HealthCheckOptions { ResponseWriter = MinimalHealthWriter.WriteAsync })
            .WithMetadata(new HttpMethodMetadata([HttpMethods.Get, HttpMethods.Head]))
            .AllowAnonymous();
    }
}

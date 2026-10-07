using Csps.Server.Http;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

namespace Csps.Server.Endpoints;

/// <summary>Maps the public, anonymous <c>/health</c> endpoint (FND-06, D-23).</summary>
public static class HealthEndpoint
{
    /// <summary>The route the health endpoint answers on.</summary>
    public const string Route = "/health";

    /// <summary>Maps <c>GET /health</c> with the minimal response writer and anonymous access.</summary>
    /// <param name="endpoints">The endpoint route builder.</param>
    /// <returns>The convention builder for further configuration.</returns>
    public static IEndpointConventionBuilder MapCspsHealth(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        return endpoints
            .MapHealthChecks(Route, new HealthCheckOptions { ResponseWriter = MinimalHealthWriter.WriteAsync })
            .AllowAnonymous();
    }
}

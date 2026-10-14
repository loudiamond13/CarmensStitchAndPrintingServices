using Csps.Application.Content;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Endpoints;

/// <summary>Staff endpoints for the site settings (D-29). Read-only in Phase 1.</summary>
public static class SiteSettingsEndpoints
{
    /// <summary>The route group prefix of the staff API.</summary>
    public const string GroupPrefix = "/api/v1";

    /// <summary>The site-settings route inside the group.</summary>
    public const string Route = "/site-settings";

    /// <summary>
    /// Maps <c>GET /api/v1/site-settings</c> in a group that requires <see cref="Policies.Staff"/>. The group is
    /// never <c>AllowAnonymous</c>: an anonymous parent would override every policy inside it.
    /// </summary>
    /// <param name="endpoints">The endpoint route builder.</param>
    /// <returns>The route group for further configuration.</returns>
    public static RouteGroupBuilder MapSiteSettings(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        var group = endpoints.MapGroup(GroupPrefix).RequireAuthorization(Policies.Staff);
        group.MapGet(Route, GetSiteSettingsAsync)
            .WithName("GetSiteSettings")
            .Produces<SiteSettingsDto>();

        return group;
    }

    private static async Task<IResult> GetSiteSettingsAsync(
        [FromServices] GetSiteSettingsHandler handler,
        HttpContext http,
        CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(http, static dto => TypedResults.Ok(dto));
    }
}

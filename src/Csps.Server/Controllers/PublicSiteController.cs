using System.Text;
using Csps.Application.Content;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Controllers;

/// <summary>
/// The public reads for visitors (PUB-02): anonymous, cached, limited per address. Every answer is the stored JSON of one cached
/// snapshot with a strong ETag and <c>Cache-Control: no-cache</c>, so a change shows on the next visit and an unchanged page costs a
/// 304 with no body (CONT-05). The JSON is never compressed (D-43).
/// </summary>
/// <param name="site">The site facts handler.</param>
[ApiController]
[Route("api/v1/public")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.PublicRead)]
[Produces("application/json")]
public sealed class PublicSiteController(GetPublicSiteHandler site) : ControllerBase
{
    /// <summary>
    /// Reads the shop facts every visitor sees: business name, tagline, about text, turnaround line, address parts, phone numbers (the
    /// main one first), the Messenger, Facebook, Instagram, TikTok, directions and map links, and the current business year. A value
    /// that is not set is null. The shop email is never sent. A request whose <c>If-None-Match</c> matches the current ETag gets 304.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the facts, 304 when the visitor's copy is current, or 429 when the address reads too often.</returns>
    [HttpGet("site")]
    [EndpointName("GetPublicSite")]
    [ProducesResponseType<PublicSiteDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> GetPublicSite(CancellationToken cancellationToken)
    {
        var result = await site.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, snapshot => Conditional(snapshot.Json));
    }

    private IResult Conditional(PublicJsonSnapshot json)
    {
        var etag = new EntityTagHeaderValue(json.ETag);
        Response.GetTypedHeaders().ETag = etag;
        Response.Headers[HeaderNames.CacheControl] = "no-cache";
        return EntityTags.Matches(Request, etag)
            ? TypedResults.StatusCode(StatusCodes.Status304NotModified)
            : TypedResults.Text(json.Json, "application/json", Encoding.UTF8);
    }
}

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
/// 304 with no body (CONT-05). The JSON is never compressed (D-43). The open status is the one exception: it has no ETag and may be
/// kept for 60 seconds.
/// </summary>
/// <param name="site">The site facts handler.</param>
/// <param name="openStatus">The open-status handler.</param>
[ApiController]
[Route("api/v1/public")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.PublicRead)]
[Produces("application/json")]
public sealed class PublicSiteController(GetPublicSiteHandler site, GetOpenStatusHandler openStatus) : ControllerBase
{
    private const string OpenStatusCacheControl = "public, max-age=60";

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

    /// <summary>
    /// Says whether the shop is open now, worked out by the server in business time (PUB-05, D-22): <c>isOpen</c>, <c>closesAt</c> ("HH:mm")
    /// when open, <c>closedToday</c>, <c>todayClosureNote</c> and <c>nextOpening</c> (<c>date</c>, <c>day</c> 1 to 7, <c>opensAt</c> and
    /// <c>when</c> of "today", "tomorrow" or "weekday") when closed and the shop opens within 14 days. The answer is public and may be
    /// kept for 60 seconds (<c>Cache-Control: public, max-age=60</c>); it has no ETag.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the open status, or 429 when the address reads too often.</returns>
    [HttpGet("open-status")]
    [EndpointName("GetOpenStatus")]
    [ProducesResponseType<OpenStatusDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> GetOpenStatus(CancellationToken cancellationToken)
    {
        var result = await openStatus.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(
            HttpContext,
            dto =>
            {
                Response.Headers[HeaderNames.CacheControl] = OpenStatusCacheControl;
                return TypedResults.Ok(dto);
            });
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

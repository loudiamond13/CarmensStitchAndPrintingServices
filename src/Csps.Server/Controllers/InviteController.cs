using Csps.Application.Auth;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// Invite acceptance (AUTH-12, D-14, D-29). Anonymous and never cached. The invite token travels in the body, never in a
/// URL, and accepting an invite signs nobody in: the person signs in normally afterwards.
/// </summary>
/// <param name="checkInvite">The invite check handler.</param>
/// <param name="acceptInvite">The invite acceptance handler.</param>
[ApiController]
[Route("api/v1/auth/invite")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class InviteController(CheckInviteHandler checkInvite, AcceptInviteHandler acceptInvite) : ControllerBase
{
    /// <summary>Tells the accept-invite page whether its link still works and which account it is for.</summary>
    /// <param name="body">The token; a null or unreadable body reads as an invalid invite.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the account email and first name, or 404 <c>auth.invite-invalid</c> for any invite that does not work.</returns>
    [HttpPost("check")]
    [EnableRateLimiting(RateLimitPolicies.Reset)]
    [IdempotencyExempt("Read-only lookup; changes nothing.")]
    [EndpointName("CheckInvite")]
    [ProducesResponseType<InviteLinkResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> Check(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] InviteTokenRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await checkInvite.HandleAsync(body ?? InviteTokenRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
    }

    /// <summary>Sets the first password from an invite. It issues no session.</summary>
    /// <param name="body">The token and the password; a null or unreadable body is reported as a field error.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>
    /// 204 with no body, 400 for a refused password, 404 <c>auth.invite-invalid</c>, 409 when two saves lost a race, or
    /// 422 <c>auth.breach-check-unavailable</c> while the breach list cannot be reached.
    /// </returns>
    [HttpPost("accept")]
    [EnableRateLimiting(RateLimitPolicies.Reset)]
    [EndpointName("AcceptInvite")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Accept(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AcceptInviteRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await acceptInvite.HandleAsync(body ?? AcceptInviteRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }
}

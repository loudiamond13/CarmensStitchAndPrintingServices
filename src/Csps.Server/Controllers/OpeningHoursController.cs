using Csps.Application.Content;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>Staff API for the shop's weekly opening hours (CONT-01, D-21, D-27): Managers only, for reading and for saving.</summary>
/// <param name="handler">The read handler.</param>
/// <param name="update">The save handler.</param>
[ApiController]
[Route("api/v1/opening-hours")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
public sealed class OpeningHoursController(GetOpeningHoursHandler handler, UpdateOpeningHoursHandler update) : ControllerBase
{
    /// <summary>
    /// Returns the seven days, Monday (1) first, each with its opening and closing time as "HH:mm" or none for a closed day, the version a
    /// save must send back, and who last changed the hours and when. Until a Manager saves hours every day is closed.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>The hours, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet]
    [EndpointName("GetOpeningHours")]
    [ProducesResponseType<OpeningHoursDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> Get(CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static dto => TypedResults.Ok(dto));
    }

    /// <summary>
    /// Saves all seven days at once. An open day needs both times, and the closing time must be after the opening time. A <c>version</c>
    /// that is not the stored one answers 409 <c>edit.stale</c> and changes nothing; a form save is never retried. A save with no change
    /// stores nothing, writes no audit entry and keeps the version. The next public read, open-status read and page show the change.
    /// Who changed it and when come from the token and the clock; any such member in the body is ignored.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the saved hours, 400 for field errors, 401 without a valid token, 403 for an Admin, or 409 for a stale version.</returns>
    [HttpPut]
    [EndpointName("UpdateOpeningHours")]
    [ProducesResponseType<OpeningHoursDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Put(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateOpeningHoursRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(body ?? UpdateOpeningHoursRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static saved => TypedResults.Ok(saved));
    }
}

using Csps.Application.Money;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// Staff money on hand (MONEY-01): every figure is summed from the records on each read, never stored. Never cached.
/// </summary>
/// <param name="myMoney">The handler that reads the caller's own money.</param>
[ApiController]
[Route("api/v1/staff-money")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class StaffMoneyController(GetMyMoneyHandler myMoney) : ControllerBase
{
    /// <summary>
    /// Reads the signed-in person's own money on hand: payments they received plus transfers to them, minus transfers from them,
    /// expenses they paid and refunds they handed back. The figure can be below zero. The person is the token's user; the route takes
    /// no id and no balance is ever accepted from a client. Nothing is cached.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the person, name, balance and the business today, or 401 without a valid token.</returns>
    [HttpGet("me")]
    [EndpointName("GetMyMoney")]
    [ProducesResponseType<StaffMoneyResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> GetMe(CancellationToken cancellationToken)
    {
        var result = await myMoney.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static figure => TypedResults.Ok(figure));
    }
}

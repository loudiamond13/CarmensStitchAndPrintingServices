using Csps.Application.Orders;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// An order's place on the public website (D-09 to D-16): staff of either role record the customer's OK and show an order or take it
/// off. This is the one public-content write that is not Manager only. Never cached.
/// </summary>
/// <param name="setSettings">The set-public-settings handler.</param>
[ApiController]
[Route("api/v1/orders/{orderId:guid}/public")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderPublicSettingsController(SetOrderPublicSettingsHandler setSettings) : ControllerBase
{
    /// <summary>
    /// Saves the customer's OK and the public settings of one order with the version the window was opened with. An order is shown only
    /// with the customer's OK, and removing the OK also takes it off the website. Who recorded the OK and when come from the token and
    /// the clock; any such member in the body is ignored. A Completed order can be shown; a Cancelled order answers 422
    /// <c>orders.public-cancelled</c>. A version that is not the stored one answers 409 <c>edit.stale</c> and changes nothing; a save is
    /// never retried. A save with no change keeps the version. The answer is the whole order.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The window; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order does not exist or was deleted, 409 for a stale version, or 422 for a Cancelled order.</returns>
    [HttpPut]
    [EndpointName("SetOrderPublicSettings")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Set(
        Guid orderId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] SetOrderPublicSettingsRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await setSettings.HandleAsync(orderId, body ?? SetOrderPublicSettingsRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}

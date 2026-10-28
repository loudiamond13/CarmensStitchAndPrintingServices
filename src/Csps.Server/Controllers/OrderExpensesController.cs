using Csps.Application.Orders;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The expenses of a saved order (ORD-05, ORD-23): staff of either role record what the order cost, with the person who paid, and
/// every answer is the whole order with its expenses and profit worked out again. An expense never changes the balance. Never cached.
/// </summary>
/// <param name="add">The add-an-expense handler.</param>
[ApiController]
[Route("api/v1/orders/{orderId:guid}/expenses")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderExpensesController(AddOrderExpenseHandler add) : ControllerBase
{
    /// <summary>
    /// Records an expense on a saved order with the order's version the form was opened with. The date is a real
    /// <c>yyyy-MM-dd</c> day: any past day, and up to 30 days after today in the shop's time zone. The amount is above 0.00 and at
    /// most 1,000,000.00 with at most two decimal places. The category must exist and not be retired. <c>paidByUserId</c> names who
    /// spent the money and must be an active Admin or Manager; it is separate from who typed the expense in, which comes from the
    /// token. The description is optional, up to 200 characters. A version that is not the stored one answers 409
    /// <c>edit.stale</c> and changes nothing; a form save is never retried. The server works out the expenses and the profit. A
    /// retry with the same <c>Idempotency-Key</c> and body answers with the stored answer and adds nothing more.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order does not exist or was deleted, 409 for a stale version, or 422 when the order already has 100 expenses.</returns>
    [HttpPost]
    [EndpointName("AddOrderExpense")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Add(
        Guid orderId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AddOrderExpenseRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await add.HandleAsync(orderId, body ?? AddOrderExpenseRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}

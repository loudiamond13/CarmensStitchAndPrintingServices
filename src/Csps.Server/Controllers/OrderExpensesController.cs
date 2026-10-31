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
/// <param name="update">The edit-an-expense handler.</param>
/// <param name="remove">The remove-an-expense handler.</param>
[ApiController]
[Route("api/v1/orders/{orderId:guid}/expenses")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderExpensesController(AddOrderExpenseHandler add, UpdateOrderExpenseHandler update, RemoveOrderExpenseHandler remove) : ControllerBase
{
    /// <summary>
    /// Records an expense on a saved order with the order's version the form was opened with. The date is a real
    /// <c>yyyy-MM-dd</c> day: any past day, and up to 30 days after today in the shop's time zone. The amount is above 0.00 and at
    /// most 1,000,000.00 with at most two decimal places. The category must exist and not be retired. <c>paidByUserId</c> names who
    /// spent the money and must be an active Admin or Manager; it is separate from who typed the expense in, which comes from the
    /// token. The description is optional, up to 200 characters. A version that is not the stored one answers 409
    /// <c>edit.stale</c> and changes nothing; a form save is never retried. The server works out the expenses and the profit. A
    /// retry with the same <c>Idempotency-Key</c> and body answers with the stored answer and adds nothing more.
    /// A Completed or Cancelled order answers 422 <c>orders.locked</c> and changes nothing.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order does not exist or was deleted, 409 for a stale version, or 422 when the order already has 100 expenses or is completed or cancelled (<c>orders.locked</c>).</returns>
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

    /// <summary>
    /// Saves an edit of one expense of a saved order with the order's version the form was opened with. The rules are the same as
    /// when adding. The category and the payer are checked only when the edit changes them, so an expense may keep a category that
    /// was retired or a payer who was deactivated after it was saved. An expense id that is not on this order answers 404
    /// <c>orders.expense-not-found</c>. A version that is not the stored one answers 409 <c>edit.stale</c> and changes nothing; a
    /// form save is never retried. An edit that changes nothing saves nothing and keeps the version. Who changed the expense and
    /// when come from the token and the clock.
    /// A Completed or Cancelled order answers 422 <c>orders.locked</c> and changes nothing.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="expenseId">The expense id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order or the expense on it does not exist, 409 for a stale version, or 422 <c>orders.locked</c> when the order is completed or cancelled.</returns>
    [HttpPut("{expenseId:guid}")]
    [EndpointName("UpdateOrderExpense")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Update(
        Guid orderId,
        Guid expenseId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateOrderExpenseRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(orderId, expenseId, body ?? UpdateOrderExpenseRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }

    /// <summary>
    /// Removes one expense of a saved order. No version is sent: the removal applies to the latest state, and a lost race is read
    /// again and decided again once. An expense id that is not on this order answers 404 <c>orders.expense-not-found</c>. The
    /// expenses and the profit are worked out again.
    /// A Completed or Cancelled order answers 422 <c>orders.locked</c> and changes nothing.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="expenseId">The expense id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 401 without a valid token, 404 when the order or the expense on it does not exist, 409 when two saves lost a race twice, or 422 <c>orders.locked</c> when the order is completed or cancelled.</returns>
    [HttpDelete("{expenseId:guid}")]
    [EndpointName("RemoveOrderExpense")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Remove(Guid orderId, Guid expenseId, CancellationToken cancellationToken)
    {
        var result = await remove.HandleAsync(orderId, expenseId, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}

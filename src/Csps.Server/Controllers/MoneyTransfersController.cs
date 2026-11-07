using Csps.Application.Money;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// Staff money transfers (MONEY-04, MONEY-05): staff of either role send part of their money on hand to a coworker. Never cached.
/// </summary>
/// <param name="create">The record-a-transfer handler.</param>
[ApiController]
[Route("api/v1/money-transfers")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class MoneyTransfersController(CreateMoneyTransferHandler create) : ControllerBase
{
    /// <summary>
    /// Records a transfer from the signed-in person to a coworker. The sender is always the token's user; the body has no sender and any
    /// such member is ignored. The amount is at least 0.01 with at most two decimal places and no more than the sender holds. The date is
    /// any day up to today in the business zone. The recipient must be an active Admin or Manager, or former staff who are owed money,
    /// and a transfer into former staff cannot go above what brings them to 0.00. The answer carries the sender's new balance and never
    /// the recipient's. Who recorded it and when come from the token and the clock; any such member in the body is ignored. A retry
    /// with the same <c>Idempotency-Key</c> and body answers with the stored 201 and records nothing more.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the transfer and the sender's balance, 400 for field errors, 401 without a valid token, or 409 when another transfer held the lock too long.</returns>
    [HttpPost]
    [EndpointName("CreateMoneyTransfer")]
    [ProducesResponseType<MoneyTransferSavedResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateMoneyTransferRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(body ?? CreateMoneyTransferRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static saved => TypedResults.Created((string?)null, saved));
    }
}

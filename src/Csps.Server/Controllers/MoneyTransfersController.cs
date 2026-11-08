using Csps.Application.Money;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// Staff money transfers (MONEY-04, MONEY-05, MONEY-06): staff of either role send part of their money on hand to a coworker, and a
/// Manager hands over money held by former staff. Never cached.
/// </summary>
/// <param name="create">The record-a-transfer handler.</param>
/// <param name="handOver">The record-a-hand-over handler.</param>
/// <param name="recipients">The who-can-receive handler.</param>
/// <param name="list">The transfer list handler.</param>
[ApiController]
[Route("api/v1/money-transfers")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class MoneyTransfersController(
    CreateMoneyTransferHandler create,
    HandOverMoneyHandler handOver,
    ListTransferRecipientsHandler recipients,
    ListMoneyTransfersHandler list) : ControllerBase
{
    /// <summary>
    /// Lists staff money transfers newest first: by transfer date, then the time recorded, then id. A Manager sees every transfer; an
    /// Admin sees only the transfers they sent or received. Each entry has the sender, the recipient, the amount, the date, the note,
    /// who recorded it, whether it is a hand-over, its version, and never a balance. Deleted transfers are shown only to a Manager who
    /// adds <c>deleted=true</c>, each marked <c>isDeleted</c> with who deleted it and when; an Admin who adds it gets a 403.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <param name="page">The page number, from 1 to 100000.</param>
    /// <param name="pageSize">Rows per page, from 1 to 100; 20 when not sent.</param>
    /// <param name="deleted">True to show deleted transfers too; Managers only.</param>
    /// <returns>200 with the page, 400 for a bad page or page size, 401 without a valid token, or 403 for an Admin who asks for deleted transfers.</returns>
    [HttpGet]
    [Authorize(Policy = Policies.Staff)]
    [EndpointName("ListMoneyTransfers")]
    [ProducesResponseType<MoneyTransferListResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> List(
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = ListMoneyTransfersRequest.DefaultPageSize,
        [FromQuery] bool deleted = false)
    {
        var result = await list.HandleAsync(new ListMoneyTransfersRequest(page, pageSize, deleted), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static transfers => TypedResults.Ok(transfers));
    }

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

    /// <summary>
    /// Records a hand-over, Managers only: money held by a deactivated or deleted Admin or Manager moves to a current coworker. The body
    /// names the former staff member (<c>fromUserId</c>) and the coworker (<c>toUserId</c>). The amount is at least 0.01 with at most two
    /// decimal places and no more than the former staff member holds. The coworker must be an active Admin or Manager, a Manager-locked
    /// or not-yet-set-up person included. The answer carries the former staff member's new balance and never the coworker's. The
    /// signed-in Manager is recorded as who did it and is written to the audit log; any <c>createdById</c> or <c>isHandover</c> in the
    /// body is ignored. A retry with the same <c>Idempotency-Key</c> and body answers with the stored 201 and records nothing more.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the hand-over and the former staff member's balance, 400 for field errors, 401 without a valid token, 403 for an Admin, or 409 when another transfer held the lock too long.</returns>
    [HttpPost("handovers")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("CreateMoneyHandover")]
    [ProducesResponseType<MoneyTransferSavedResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> HandOver(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateMoneyHandoverRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await handOver.HandleAsync(body ?? CreateMoneyHandoverRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static saved => TypedResults.Created((string?)null, saved));
    }

    /// <summary>
    /// Lists who the transfer window may offer, for either role. Every active Admin and Manager comes first, a person a Manager has
    /// locked or who has not finished set-up included, with the signed-in person marked <c>isYou</c>. Then come the deactivated or
    /// deleted Admins and Managers who are owed money, with status <c>deactivated</c> or <c>deleted</c>. An entry has an id, a name, a
    /// status and <c>isYou</c> and never a figure, for any caller. The legacy placeholder and accounts with no staff role never appear.
    /// Each group is sorted by first name, last name, then id.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the people, or 401 without a valid token.</returns>
    [HttpGet("recipients")]
    [EndpointName("ListTransferRecipients")]
    [ProducesResponseType<IReadOnlyList<TransferRecipientResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> ListRecipients(CancellationToken cancellationToken)
    {
        var result = await recipients.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static people => TypedResults.Ok(people));
    }
}

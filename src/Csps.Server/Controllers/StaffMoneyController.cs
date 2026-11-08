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
/// <param name="ledger">The handler that reads a ledger.</param>
/// <param name="balances">The handler that lists everyone's money on hand.</param>
/// <param name="staffMoney">The handler that reads one named person's money.</param>
[ApiController]
[Route("api/v1/staff-money")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class StaffMoneyController(GetMyMoneyHandler myMoney, GetLedgerHandler ledger, ListStaffBalancesHandler balances, GetStaffMoneyHandler staffMoney)
    : ControllerBase
{
    /// <summary>
    /// Lists what every staff member holds, Managers only. Every active Admin and Manager comes first by name, a person a Manager has
    /// locked or who has not finished set-up included, with the signed-in person marked <c>isYou</c>. Then come the deactivated or
    /// deleted Admins and Managers whose balance is not 0.00, by name. Each entry has the person, name, role, status
    /// (<c>active</c>, <c>deactivated</c> or <c>deleted</c>), balance and <c>isYou</c>. <c>total</c> is the sum of the listed balances
    /// and may be below zero. The legacy placeholder and accounts with no staff role never appear. Nothing is cached.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the people and the total, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("ListStaffBalances")]
    [ProducesResponseType<StaffBalancesResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> ListBalances(CancellationToken cancellationToken)
    {
        var result = await balances.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static people => TypedResults.Ok(people));
    }

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

    /// <summary>
    /// Reads one page of the signed-in person's own money rows, newest first by date and then by the time recorded. Each row has its
    /// kind, date, money in or money out (the other is null), the details its kind names, and <c>balanceAfter</c>: the running balance
    /// after that row, worked out on the server. The newest row's balance after equals the money on hand. A Manager may add
    /// <c>deleted=true</c> to see deleted transfers in their own ledger; they carry no balance after. The route takes no id. Nothing is cached.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <param name="page">The page number, from 1 to 100000.</param>
    /// <param name="pageSize">Rows per page, from 1 to 100; 20 when not sent.</param>
    /// <param name="deleted">True to show deleted transfers too; Managers only.</param>
    /// <returns>200 with the page, 400 for a bad page or page size, 401 without a valid token, or 403 for an Admin who asks for deleted transfers.</returns>
    [HttpGet("me/ledger")]
    [EndpointName("GetMyLedger")]
    [ProducesResponseType<LedgerPageResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> GetMyLedger(
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = GetLedgerRequest.DefaultPageSize,
        [FromQuery] bool deleted = false)
    {
        var result = await ledger.HandleAsync(null, new GetLedgerRequest(page, pageSize, deleted), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static ledgerPage => TypedResults.Ok(ledgerPage));
    }

    /// <summary>
    /// Reads one named person's money on hand: name, role, status (<c>active</c>, <c>deactivated</c> or <c>deleted</c>), balance and the
    /// business today. An Admin may ask only for their own id, which answers like <c>me</c>; any other id is a 403 decided from the
    /// token alone, before any lookup, so a real coworker and a made-up id look the same. A Manager may ask for any Admin or Manager,
    /// former staff included; an unknown id, the legacy placeholder or an account with no staff role is a 404. Nothing is cached.
    /// </summary>
    /// <param name="userId">The person asked about.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the figure, 401 without a valid token, 403 for an Admin asking about someone else, or 404 for a Manager asking about no staff member.</returns>
    [HttpGet("{userId:guid}")]
    [Authorize(Policy = Policies.Staff)]
    [EndpointName("GetStaffMoney")]
    [ProducesResponseType<StaffMoneyResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> GetStaff(Guid userId, CancellationToken cancellationToken)
    {
        var result = await staffMoney.HandleAsync(userId, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static figure => TypedResults.Ok(figure));
    }

    /// <summary>
    /// Reads one page of one named person's money rows, shaped like <c>me/ledger</c> and under the same access rule as the person's
    /// figure: an Admin may name only themselves and gets a 403 for any other id before any lookup; a Manager may name any Admin or
    /// Manager, former staff included, and gets a 404 for anyone else. Only a Manager may add <c>deleted=true</c> to see deleted
    /// transfers. Nothing is cached.
    /// </summary>
    /// <param name="userId">The person asked about.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <param name="page">The page number, from 1 to 100000.</param>
    /// <param name="pageSize">Rows per page, from 1 to 100; 20 when not sent.</param>
    /// <param name="deleted">True to show deleted transfers too; Managers only.</param>
    /// <returns>200 with the page, 400 for a bad page or page size, 401 without a valid token, 403 for an Admin asking about someone else or for deleted transfers, or 404 for a Manager asking about no staff member.</returns>
    [HttpGet("{userId:guid}/ledger")]
    [Authorize(Policy = Policies.Staff)]
    [EndpointName("GetStaffLedger")]
    [ProducesResponseType<LedgerPageResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> GetStaffLedger(
        Guid userId,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = GetLedgerRequest.DefaultPageSize,
        [FromQuery] bool deleted = false)
    {
        var result = await ledger.HandleAsync(userId, new GetLedgerRequest(page, pageSize, deleted), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static ledgerPage => TypedResults.Ok(ledgerPage));
    }
}

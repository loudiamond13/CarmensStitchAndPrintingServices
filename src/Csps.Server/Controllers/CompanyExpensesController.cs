using Csps.Application.Expenses;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The shop's company expenses (CEXP-02): staff of either role record and read them, and see every expense (D-25). Never cached.
/// </summary>
/// <param name="create">The record-an-expense handler.</param>
/// <param name="get">The single-expense read handler.</param>
[ApiController]
[Route("api/v1/company-expenses")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class CompanyExpensesController(CreateCompanyExpenseHandler create, GetCompanyExpenseHandler get) : ControllerBase
{
    /// <summary>
    /// Records an expense. The date may be any past day and up to 30 days after today in the business zone, the amount is above
    /// 0.00 and at most 1,000,000.00 with two decimal places, and the payer must be an active Admin or Manager who has set a
    /// password. A retired category is refused. Who recorded it and when come from the token and the clock; any such member in the
    /// body is ignored. A retry with the same <c>Idempotency-Key</c> and body answers with the stored 201 and records nothing more.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the expense and its location, 400 for field errors, or 401 without a valid token.</returns>
    [HttpPost]
    [EndpointName("CreateCompanyExpense")]
    [ProducesResponseType<CompanyExpenseDetailResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateCompanyExpenseRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(body ?? CreateCompanyExpenseRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/company-expenses/{created.Id:D}", created));
    }

    /// <summary>Reads one expense with its version, who recorded it and last changed it, and whether the caller may edit it.</summary>
    /// <param name="id">The expense id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the expense, 401 without a valid token, or 404 when the expense does not exist or was deleted.</returns>
    [HttpGet("{id:guid}")]
    [EndpointName("GetCompanyExpense")]
    [ProducesResponseType<CompanyExpenseDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await get.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static expense => TypedResults.Ok(expense));
    }
}

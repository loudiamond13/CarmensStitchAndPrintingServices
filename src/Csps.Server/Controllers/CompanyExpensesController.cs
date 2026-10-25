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
/// <param name="list">The expense list handler.</param>
/// <param name="kpis">The month KPI handler.</param>
[ApiController]
[Route("api/v1/company-expenses")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class CompanyExpensesController(CreateCompanyExpenseHandler create, GetCompanyExpenseHandler get, ListCompanyExpensesHandler list, GetCompanyExpenseKpisHandler kpis) : ControllerBase
{
    /// <summary>
    /// Lists expenses, newest first by expense date, then by when they were recorded, then by id. With neither date the window runs
    /// from 30 days before to 30 days after today in the business zone, and the answer says which dates and which today it used.
    /// The total and the period total cover every page of the filter. Both roles see every expense; <c>canEdit</c> says whether the
    /// caller may edit a row. Notes are never listed or searched.
    /// </summary>
    /// <param name="q">Search text for the description or the payer's or recorder's name; blank means no search.</param>
    /// <param name="category">A category id; none means all.</param>
    /// <param name="from">The first expense date as <c>yyyy-MM-dd</c>; send it with <c>to</c> or not at all.</param>
    /// <param name="to">The last expense date as <c>yyyy-MM-dd</c>; send it with <c>from</c> or not at all.</param>
    /// <param name="page">The page number, from 1 to 100000.</param>
    /// <param name="pageSize">Rows per page, from 1 to 100; 20 when not sent.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the page, 400 for a bad filter or page, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("ListCompanyExpenses")]
    [ProducesResponseType<CompanyExpenseListResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> List(
        [FromQuery] string? q,
        [FromQuery] string? category,
        [FromQuery] string? from,
        [FromQuery] string? to,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = ListCompanyExpensesRequest.DefaultPageSize)
    {
        var result = await list.HandleAsync(new ListCompanyExpensesRequest(q, category, from, to, page, pageSize), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static expenses => TypedResults.Ok(expenses));
    }

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

    /// <summary>
    /// Reads the month figures for the expenses page: this month and last month, each with its total and count, and this month's top
    /// category with its share. Months follow the business zone, expenses count by their date (upcoming ones included) and deleted
    /// expenses never count. The list filters do not apply.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the KPIs, or 401 without a valid token.</returns>
    [HttpGet("kpis")]
    [EndpointName("GetCompanyExpenseKpis")]
    [ProducesResponseType<CompanyExpenseKpisResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> Kpis(CancellationToken cancellationToken)
    {
        var result = await kpis.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static figures => TypedResults.Ok(figures));
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

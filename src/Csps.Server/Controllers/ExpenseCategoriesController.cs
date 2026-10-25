using Csps.Application.ExpenseCategories;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The company expense categories (D-08): staff of either role read them, and only Managers add or change them (D-14). Never cached.
/// </summary>
/// <param name="list">The list handler.</param>
/// <param name="create">The add-a-category handler (Managers only).</param>
[ApiController]
[Route("api/v1/expense-categories")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ExpenseCategoriesController(ListExpenseCategoriesHandler list, CreateExpenseCategoryHandler create) : ControllerBase
{
    /// <summary>
    /// Lists every category, retired ones included with status <c>retired</c>, A to Z with Others always last, then by id. Each item
    /// says how many expenses use the category, soft-deleted ones included. The Add picker hides retired ones; the list filter keeps them.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the categories, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("ListExpenseCategories")]
    [ProducesResponseType<IReadOnlyList<ExpenseCategoryListItem>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> List(CancellationToken cancellationToken)
    {
        var result = await list.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static categories => TypedResults.Ok(categories));
    }

    /// <summary>
    /// Adds a category, Managers only. The name is required, at most 40 characters and unique among all categories, retired ones
    /// included, ignoring letter case. The tone is one of six: <c>neutral</c>, <c>accent</c>, <c>info</c>, <c>mockup</c>,
    /// <c>warning</c> or <c>success</c>. Who added it and when come from the token and the clock; any such member in the body is
    /// ignored. A retry with the same <c>Idempotency-Key</c> and body answers with the stored 201 and adds nothing more.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the category and its location, 400 for field errors, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpPost]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("CreateExpenseCategory")]
    [ProducesResponseType<ExpenseCategoryListItem>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateExpenseCategoryRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(body ?? CreateExpenseCategoryRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/expense-categories/{created.Id:D}", created));
    }
}

using Csps.Application.ExpenseCategories;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>The company expense categories (D-08): staff of either role read them. Never cached.</summary>
/// <param name="list">The list handler.</param>
[ApiController]
[Route("api/v1/expense-categories")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ExpenseCategoriesController(ListExpenseCategoriesHandler list) : ControllerBase
{
    /// <summary>
    /// Lists every category, retired ones included with status <c>retired</c>, A to Z with Others always last, then by id.
    /// The Add picker hides retired ones; the list filter keeps them.
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
}

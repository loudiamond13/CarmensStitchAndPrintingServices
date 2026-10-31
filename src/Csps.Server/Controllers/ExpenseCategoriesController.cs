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
/// <param name="get">The single-category read handler (Managers only).</param>
/// <param name="update">The rename-and-recolor handler (Managers only).</param>
/// <param name="retire">The retire handler (Managers only).</param>
/// <param name="reactivate">The bring-back handler (Managers only).</param>
/// <param name="delete">The delete handler (Managers only).</param>
[ApiController]
[Route("api/v1/expense-categories")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ExpenseCategoriesController(ListExpenseCategoriesHandler list, CreateExpenseCategoryHandler create, GetExpenseCategoryHandler get, UpdateExpenseCategoryHandler update, RetireExpenseCategoryHandler retire, ReactivateExpenseCategoryHandler reactivate, DeleteExpenseCategoryHandler delete) : ControllerBase
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

    /// <summary>Reads one category with how many expenses use it, who recorded and last changed it, and the version a save must send back. Managers only.</summary>
    /// <param name="id">The category id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the category, 401 without a valid token, 403 for an Admin, or 404 when the category does not exist.</returns>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("GetExpenseCategory")]
    [ProducesResponseType<ExpenseCategoryDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await get.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static category => TypedResults.Ok(category));
    }

    /// <summary>
    /// Renames and recolors one category with the version the form was opened with, Managers only. The new name shows on every
    /// expense, past ones included. The name and tone follow the same rules as when adding. Others keeps its name but may change
    /// colour. A version that is not the stored one answers 409 <c>edit.stale</c> and changes nothing; a form edit is never retried.
    /// A form with no change saves nothing and keeps the version. Who changed it and when come from the token and the clock; any such
    /// member in the body is ignored.
    /// </summary>
    /// <param name="id">The category id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the saved category, 400 for field errors, 401 without a valid token, 403 for an Admin, 404 when the category does not exist, or 409 for a stale version.</returns>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("UpdateExpenseCategory")]
    [ProducesResponseType<ExpenseCategoryDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Update(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateExpenseCategoryRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(id, body ?? UpdateExpenseCategoryRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static saved => TypedResults.Ok(saved));
    }

    /// <summary>
    /// Retires a category, Managers only: it can no longer be chosen on a new expense but stays in the list and the list filter,
    /// marked <c>retired</c>, and old expenses keep it. Others can never be retired. Retiring a retired category is a 204 that
    /// changes and records nothing. It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204.
    /// </summary>
    /// <param name="id">The category id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when the category does not exist, 422 for Others, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/retire")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("RetireExpenseCategory")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Retire(Guid id, CancellationToken cancellationToken)
    {
        var result = await retire.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Brings a retired category back, Managers only: it can be chosen on a new expense again. Bringing back an active category is a
    /// 204 that changes and records nothing. It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the
    /// stored 204.
    /// </summary>
    /// <param name="id">The category id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when the category does not exist, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/reactivate")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("ReactivateExpenseCategory")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Reactivate(Guid id, CancellationToken cancellationToken)
    {
        var result = await reactivate.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Deletes a category, Managers only, while no expense uses it. An expense uses it when a row exists, soft-deleted ones included;
    /// once every expense in it is deleted for good it can be deleted again. A used category answers 422
    /// <c>expense-categories.in-use</c> and should be retired instead. Others can never be deleted. It takes no version.
    /// </summary>
    /// <param name="id">The category id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when the category does not exist, 422 for Others or a used category, or 409 when two saves lost a race.</returns>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("DeleteExpenseCategory")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await delete.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }
}

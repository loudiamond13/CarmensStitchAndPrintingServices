using Csps.Application.Content;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>Staff API for the public product lines (CONT-02, D-01, D-08, D-09): Managers only. Never cached.</summary>
/// <param name="list">The list handler.</param>
/// <param name="get">The read handler.</param>
/// <param name="create">The add handler.</param>
/// <param name="update">The edit handler.</param>
/// <param name="move">The move handler.</param>
/// <param name="setShown">The hide and show handler.</param>
/// <param name="delete">The delete handler.</param>
[ApiController]
[Route("api/v1/product-lines")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ProductLinesController(
    ListProductLinesHandler list,
    GetProductLineHandler get,
    CreateProductLineHandler create,
    UpdateProductLineHandler update,
    MoveProductLineHandler move,
    SetProductLineShownHandler setShown,
    DeleteProductLineHandler delete) : ControllerBase
{
    /// <summary>
    /// Lists every product line, shown and hidden, in display order. Each has its id, key, title, short name, starting price and minimum
    /// order (null when not set), whether it is shown, its position from 1, the small main photo (null until it has one), the ids of the
    /// order product types filed under it, how many shown gallery items and photos it has, whether it can be deleted, and the version an
    /// edit must send back.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the lines, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet]
    [EndpointName("ListProductLines")]
    [ProducesResponseType<IReadOnlyList<ProductLineListItemDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> List(CancellationToken cancellationToken)
    {
        var result = await list.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static items => TypedResults.Ok(items));
    }

    /// <summary>Reads one product line with every field, the order product types filed under it, its version and who last changed it.</summary>
    /// <param name="id">The line id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the line, 401 without a valid token, 403 for an Admin, or 404 when it does not exist.</returns>
    [HttpGet("{id:guid}")]
    [EndpointName("GetProductLine")]
    [ProducesResponseType<ProductLineDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await get.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static line => TypedResults.Ok(line));
    }

    /// <summary>
    /// Adds a product line. The line goes to the end of the order with the custom drawing and is hidden unless <c>isActive</c> is true.
    /// Its URL key is made once from the short name and never changes. A retry with the same <c>Idempotency-Key</c> and body answers
    /// with the stored 201 and adds nothing more. Who added it and when come from the token and the clock; any such member in the body
    /// is ignored.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the line and its location, 400 for field errors, 401 without a valid token, 403 for an Admin, or 409 when the save lost a race.</returns>
    [HttpPost]
    [EndpointName("CreateProductLine")]
    [ProducesResponseType<ProductLineDetailDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ProductLineRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(body ?? ProductLineRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/product-lines/{created.Id:D}", created));
    }

    /// <summary>
    /// Edits a product line with the version the form was opened with. The values follow the same rules as when adding. A
    /// <c>version</c> that is not the stored one answers 409 <c>edit.stale</c> and changes nothing; a form edit is never retried. A form
    /// with no change stores nothing and keeps the version. The key never changes. Who changed it and when come from the token and the
    /// clock; any such member in the body is ignored.
    /// </summary>
    /// <param name="id">The line id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the saved line, 400 for field errors, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 for a stale version or a lost race.</returns>
    [HttpPut("{id:guid}")]
    [EndpointName("UpdateProductLine")]
    [ProducesResponseType<ProductLineDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Update(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ProductLineRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(id, body ?? ProductLineRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static saved => TypedResults.Ok(saved));
    }

    /// <summary>
    /// Moves a line one place up or down in the display order. A move at the end of the order is a 204 that changes and records nothing.
    /// It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204.
    /// </summary>
    /// <param name="id">The line id.</param>
    /// <param name="body">The direction, <c>up</c> or <c>down</c>; a null or unreadable body is reported as a field error.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 400 for a direction that is not up or down, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/move")]
    [EndpointName("MoveProductLine")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Move(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] MoveProductLineRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await move.HandleAsync(id, body ?? MoveProductLineRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Hides a line: it and everything filed under it leave the public site, and nothing is lost. Hiding a hidden line is a 204 that
    /// changes and records nothing. It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204.
    /// </summary>
    /// <param name="id">The line id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/hide")]
    [EndpointName("HideProductLine")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Hide(Guid id, CancellationToken cancellationToken)
    {
        var result = await setShown.HandleAsync(id, shown: false, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Shows a hidden line on the public site again. Showing a shown line is a 204 that changes and records nothing. It takes no
    /// version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204.
    /// </summary>
    /// <param name="id">The line id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/show")]
    [EndpointName("ShowProductLine")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Show(Guid id, CancellationToken cancellationToken)
    {
        var result = await setShown.HandleAsync(id, shown: true, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Deletes a product line for good. It takes no version. Deleting a line that is already gone is a 404.
    /// </summary>
    /// <param name="id">The line id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, or 404 when it does not exist.</returns>
    [HttpDelete("{id:guid}")]
    [EndpointName("DeleteProductLine")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await delete.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }
}

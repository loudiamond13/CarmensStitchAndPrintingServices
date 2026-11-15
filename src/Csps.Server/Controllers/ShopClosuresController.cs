using Csps.Application.Content;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>Staff API for the shop's holidays and closures (CONT-04, D-21, D-27): Managers only. Never cached.</summary>
/// <param name="list">The list handler.</param>
/// <param name="create">The add handler.</param>
/// <param name="update">The edit handler.</param>
/// <param name="delete">The delete handler.</param>
[ApiController]
[Route("api/v1/shop-closures")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ShopClosuresController(
    ListShopClosuresHandler list,
    CreateShopClosureHandler create,
    UpdateShopClosureHandler update,
    DeleteShopClosureHandler delete) : ControllerBase
{
    /// <summary>
    /// Lists the upcoming closures: every closure whose last day is today or later in business time, by first day. Each has its id, its
    /// first and last day as "yyyy-MM-dd" (the same day for a single day), its public note or none, and the version an edit must send
    /// back. Past closures are not listed.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the closures, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet]
    [EndpointName("ListShopClosures")]
    [ProducesResponseType<IReadOnlyList<ShopClosureDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> List(CancellationToken cancellationToken)
    {
        var result = await list.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static items => TypedResults.Ok(items));
    }

    /// <summary>
    /// Adds a closure. The first day is required and is today or later in business time. The last day is optional, on or after the first
    /// day and at most 31 days in all; leave it out for one day. The note is optional and at most 80 characters. A closure that shares a
    /// day with another one is a 400 on <c>firstDay</c> naming the first shared day, such as "There's already a closure on Dec 25,
    /// 2026." If the shop is busy saving another closure the answer is 409. Who added it and when come from the token and the clock; any
    /// such member in the body is ignored. A retry with the same <c>Idempotency-Key</c> and body answers with the stored 201 and adds
    /// nothing more. The next public read, open-status read and page show the closure.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the closure and its location, 400 for field errors, 401 without a valid token, 403 for an Admin, or 409 when the save lost a race.</returns>
    [HttpPost]
    [EndpointName("CreateShopClosure")]
    [ProducesResponseType<ShopClosureDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ShopClosureRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(body ?? ShopClosureRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/shop-closures/{created.Id:D}", created));
    }

    /// <summary>
    /// Edits a closure with the version the form was opened with. The days and the note follow the same rules as when adding, except
    /// that a first day that is already past is kept as it is, so the note of a closure that is running can still be fixed. A
    /// <c>version</c> that is not the stored one answers 409 <c>edit.stale</c> and changes nothing; a form edit is never retried. A form
    /// with no change stores nothing and keeps the version. Who changed it and when come from the token and the clock; any such member
    /// in the body is ignored.
    /// </summary>
    /// <param name="id">The closure id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the saved closure, 400 for field errors, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 for a stale version or a lost race.</returns>
    [HttpPut("{id:guid}")]
    [EndpointName("UpdateShopClosure")]
    [ProducesResponseType<ShopClosureDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Update(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ShopClosureRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(id, body ?? ShopClosureRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static saved => TypedResults.Ok(saved));
    }

    /// <summary>Deletes a closure for good; the shop shows its normal hours on those days again. It takes no version. Deleting a closure that is already gone is a 404.</summary>
    /// <param name="id">The closure id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpDelete("{id:guid}")]
    [EndpointName("DeleteShopClosure")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await delete.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }
}

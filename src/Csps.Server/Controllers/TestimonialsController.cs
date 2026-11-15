using Csps.Application.Content;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>Staff API for the testimonials the public Home page shows (CONT-03, D-05): Managers only. Never cached.</summary>
/// <param name="list">The list handler.</param>
/// <param name="create">The add handler.</param>
/// <param name="update">The edit handler.</param>
/// <param name="move">The move handler.</param>
/// <param name="setShown">The hide and show handler.</param>
/// <param name="delete">The delete handler.</param>
[ApiController]
[Route("api/v1/testimonials")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TestimonialsController(
    ListTestimonialsHandler list,
    CreateTestimonialHandler create,
    UpdateTestimonialHandler update,
    MoveTestimonialHandler move,
    SetTestimonialShownHandler setShown,
    DeleteTestimonialHandler delete) : ControllerBase
{
    /// <summary>
    /// Lists every testimonial, shown and hidden, in display order. Each has its id, quote, name, team or role (null when not set), stars,
    /// position from 1, whether it is shown, and the version an edit must send back. The Home page shows the first three shown ones.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the testimonials, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet]
    [EndpointName("ListTestimonials")]
    [ProducesResponseType<IReadOnlyList<TestimonialDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> List(CancellationToken cancellationToken)
    {
        var result = await list.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static items => TypedResults.Ok(items));
    }

    /// <summary>
    /// Adds a testimonial. It goes to the end of the order and is hidden unless <c>isShown</c> is true. A retry with the same
    /// <c>Idempotency-Key</c> and body answers with the stored 201 and adds nothing more. Who added it and when come from the token and
    /// the clock; any such member in the body is ignored.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the testimonial and its location, 400 for field errors, 401 without a valid token, 403 for an Admin, or 409 when the save lost a race.</returns>
    [HttpPost]
    [EndpointName("CreateTestimonial")]
    [ProducesResponseType<TestimonialDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] TestimonialRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(body ?? TestimonialRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/testimonials/{created.Id:D}", created));
    }

    /// <summary>
    /// Edits a testimonial with the version the form was opened with. The values follow the same rules as when adding. A
    /// <c>version</c> that is not the stored one answers 409 <c>edit.stale</c> and changes nothing; a form edit is never retried. A form
    /// with no change stores nothing and keeps the version. Who changed it and when come from the token and the clock; any such member in
    /// the body is ignored.
    /// </summary>
    /// <param name="id">The testimonial id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the saved testimonial, 400 for field errors, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 for a stale version.</returns>
    [HttpPut("{id:guid}")]
    [EndpointName("UpdateTestimonial")]
    [ProducesResponseType<TestimonialDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Update(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] TestimonialRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(id, body ?? TestimonialRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static saved => TypedResults.Ok(saved));
    }

    /// <summary>
    /// Moves a testimonial one place up or down in the display order. A move at the end of the order is a 204 that changes and records
    /// nothing. It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204.
    /// </summary>
    /// <param name="id">The testimonial id.</param>
    /// <param name="body">The direction, <c>up</c> or <c>down</c>; a null or unreadable body is reported as a field error.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 400 for a direction that is not up or down, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/move")]
    [EndpointName("MoveTestimonial")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Move(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] MoveTestimonialRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await move.HandleAsync(id, body ?? MoveTestimonialRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Hides a testimonial: it leaves the public Home page and nothing is lost. Hiding a hidden testimonial is a 204 that changes and
    /// records nothing. It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204.
    /// </summary>
    /// <param name="id">The testimonial id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/hide")]
    [EndpointName("HideTestimonial")]
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
    /// Shows a hidden testimonial on the public site again. Showing a shown testimonial is a 204 that changes and records nothing. It
    /// takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204.
    /// </summary>
    /// <param name="id">The testimonial id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/show")]
    [EndpointName("ShowTestimonial")]
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

    /// <summary>Deletes a testimonial for good. It takes no version. Deleting a testimonial that is already gone is a 404.</summary>
    /// <param name="id">The testimonial id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpDelete("{id:guid}")]
    [EndpointName("DeleteTestimonial")]
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

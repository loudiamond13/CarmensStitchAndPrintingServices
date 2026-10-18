using Csps.Application.Security;
using Csps.Application.Users;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The staff roster (USER-01): Managers only (USER-08). An Admin gets 403 and a caller with no valid token gets 401.
/// Deleted people are never listed or read (D-09). Never cached.
/// </summary>
/// <param name="list">The roster list handler.</param>
/// <param name="get">The single-person read handler.</param>
/// <param name="create">The add-a-person handler.</param>
/// <param name="deactivate">The deactivate handler.</param>
/// <param name="activate">The reactivate handler.</param>
/// <param name="lockUser">The lock handler.</param>
/// <param name="unlockUser">The unlock handler.</param>
/// <param name="update">The edit-a-person handler.</param>
/// <param name="cancelEmailChange">The handler that calls off a waiting email change.</param>
[ApiController]
[Route("api/v1/users")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class UsersController(
    ListUsersHandler list,
    GetUserHandler get,
    CreateUserHandler create,
    DeactivateUserHandler deactivate,
    ActivateUserHandler activate,
    LockUserHandler lockUser,
    UnlockUserHandler unlockUser,
    UpdateUserHandler update,
    CancelUserEmailChangeHandler cancelEmailChange) : ControllerBase
{
    /// <summary>
    /// Lists staff, sorted by first name, then last name, then id. A page past the last returns no rows and the true total.
    /// </summary>
    /// <param name="q">Search text for the name or email; blank means no search.</param>
    /// <param name="role"><c>admin</c> or <c>manager</c>; none means both.</param>
    /// <param name="status"><c>active</c>, <c>inactive</c> or <c>locked</c>; none means all.</param>
    /// <param name="page">The page number, from 1.</param>
    /// <param name="pageSize">Rows per page, from 1 to 100; 20 when not sent.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the page, 400 for a bad filter or page, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet]
    [EndpointName("ListUsers")]
    [ProducesResponseType<UserListResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> List(
        [FromQuery] string? q,
        [FromQuery] string? role,
        [FromQuery] string? status,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = ListUsersRequest.DefaultPageSize)
    {
        var result = await list.HandleAsync(new ListUsersRequest(q, role, status, page, pageSize), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static roster => TypedResults.Ok(roster));
    }

    /// <summary>Reads one person with their edit version and who created and last changed them (SEC-08).</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the person, 401 without a valid token, 403 for an Admin, or 404 when the person does not exist or was deleted.</returns>
    [HttpGet("{id:guid}")]
    [EndpointName("GetUser")]
    [ProducesResponseType<UserDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await get.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static person => TypedResults.Ok(person));
    }

    /// <summary>
    /// Adds a staff member (USER-02). By invitation the account has no password and a 7-day link is emailed; with a temporary
    /// password the Manager hands it over and the person must replace it at first sign-in. The answer holds the new id only.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the new id and the location of the person, 400 for field errors (a taken email is one), 401 without a valid token, or 403 for an Admin.</returns>
    [HttpPost]
    [EndpointName("CreateUser")]
    [ProducesResponseType<CreateUserResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateUserRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(body ?? CreateUserRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/users/{created.Id:D}", created));
    }

    /// <summary>
    /// Edits another person's name, sign-in email and role (USER-03). The version must be the one the form was opened with: any other
    /// answers 409 <c>edit.stale</c> and changes nothing (SEC-07). A Manager cannot edit their own account here (422
    /// <c>users.own-account</c>), and cannot demote the last active Manager (422 <c>users.last-active-manager</c>). A role change ends
    /// every session of the person at once. Saving the values already stored is a 200 that changes and records nothing.
    /// When the email differs from the stored one, <c>emailChange</c> must say how it applies (D-45), and a missing or unknown value is
    /// a 400 on that field: <c>confirm</c> keeps the sign-in email and sends the new address a confirmation link that names the Manager,
    /// with a notice to the old address (C-9), and the answer shows the new address as <c>pendingEmail</c>; <c>now</c> changes the email
    /// in the same save, signs the person out everywhere and notifies the old address. A person invited but not yet set up always moves
    /// at once and gets a fresh invitation at the new address. A taken address is a 400 on <c>email</c>. <c>emailChange</c> is ignored
    /// when the email is unchanged.
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the person as saved, 400 for field errors, 401 without a valid token, 403 for an Admin, 404 when the person does not exist or was deleted, 409 when the form is out of date, or 422 for the caller's own account or the last active Manager.</returns>
    [HttpPut("{id:guid}")]
    [EndpointName("UpdateUser")]
    [ProducesResponseType<UserDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Update(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateUserRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(id, body ?? UpdateUserRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static person => TypedResults.Ok(person));
    }

    /// <summary>
    /// Calls off a person's waiting email change (USER-03, C-9): the open links stop working and the pending address is cleared. With
    /// nothing waiting it is a 204 that changes nothing. It takes no version: it acts on the latest state (D-21). A Manager uses My
    /// Profile for their own account (422 <c>users.own-account</c>).
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when the person does not exist or was deleted, 409 when two saves lost a race, or 422 for the caller's own account.</returns>
    [HttpDelete("{id:guid}/email-change")]
    [EndpointName("CancelUserEmailChange")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> CancelEmailChange(Guid id, CancellationToken cancellationToken)
    {
        var result = await cancelEmailChange.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Deactivates a person (USER-03): they cannot sign in and every session of theirs ends at once, so their next request with an old
    /// token is a 401. Repeating it on an inactive person is a 204 that changes nothing. It takes no version: it acts on the latest state.
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when the person does not exist or was deleted, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/deactivate")]
    [EndpointName("DeactivateUser")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        var result = await deactivate.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>Reactivates a person (USER-03). Repeating it on an active person is a 204 that changes nothing. It takes no version.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when the person does not exist or was deleted, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/activate")]
    [EndpointName("ActivateUser")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Activate(Guid id, CancellationToken cancellationToken)
    {
        var result = await activate.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Locks a person (USER-03, D-16): they cannot sign in, a password reset does not help, and every session of theirs ends at once, so
    /// their next request with an old token is a 401. The lock has no timer; only a Manager lifts it. It is separate from the 15-minute
    /// failed-password lockout. Repeating it on a locked person is a 204 that changes nothing. It takes no version: it acts on the latest
    /// state.
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when the person does not exist or was deleted, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/lock")]
    [EndpointName("LockUser")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Lock(Guid id, CancellationToken cancellationToken)
    {
        var result = await lockUser.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Lifts a person's Manager lock (USER-03, D-16). The 15-minute failed-password lockout, if one is running, is left alone. Repeating
    /// it on a person who is not locked is a 204 that changes nothing. It takes no version.
    /// </summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when the person does not exist or was deleted, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/unlock")]
    [EndpointName("UnlockUser")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Unlock(Guid id, CancellationToken cancellationToken)
    {
        var result = await unlockUser.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }
}

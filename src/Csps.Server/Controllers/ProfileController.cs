using Csps.Application.Profile;
using Csps.Application.Security;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;

namespace Csps.Server.Controllers;

/// <summary>
/// The signed-in staff member's own profile (PROF-01, PROF-02, PROF-03): read it, change the name, ask to change the sign-in email,
/// check and confirm that change from the emailed link, and change the password. There is no user id in the route; every signed-in call acts
/// on the token's user only (CWE-639). Never cached.
/// </summary>
/// <param name="get">The read handler.</param>
/// <param name="update">The name-save handler.</param>
/// <param name="changePassword">The password-change handler.</param>
/// <param name="requestEmailChange">The email-change request handler.</param>
/// <param name="confirmEmailChange">The email-change confirmation handler.</param>
/// <param name="checkEmailChange">The email-change link check handler.</param>
[ApiController]
[Route("api/v1/profile")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ProfileController(
    GetProfileHandler get,
    UpdateProfileNameHandler update,
    ChangePasswordHandler changePassword,
    RequestEmailChangeHandler requestEmailChange,
    ConfirmEmailChangeHandler confirmEmailChange,
    CheckEmailChangeHandler checkEmailChange) : ControllerBase
{
    /// <summary>Reads the caller's profile, including the edit version the next save must send.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the profile, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("GetProfile")]
    [ProducesResponseType<ProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> Get(CancellationToken cancellationToken)
    {
        var result = await get.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static profile => TypedResults.Ok(profile));
    }

    /// <summary>Changes the caller's first and last name. The version must be the one the form was opened with.</summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the profile, 400 for field errors, 401 without a valid token, or 409 when the form is out of date.</returns>
    [HttpPut]
    [EndpointName("UpdateProfileName")]
    [ProducesResponseType<ProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Update(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateProfileNameRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(body ?? UpdateProfileNameRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static profile => TypedResults.Ok(profile));
    }

    /// <summary>Changes the caller's password after checking the current one. Every other device is signed out; this one stays signed in.</summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204 with no body, 400 for field errors (a wrong current password is one), 401 without a valid token, 409 when two saves lost a race, or 429 <c>profile.password-locked</c> (with Retry-After) while the account is locked.</returns>
    [HttpPost("password")]
    [EnableRateLimiting(RateLimitPolicies.Reset)]
    [EndpointName("ChangePassword")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> ChangePassword(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ChangePasswordRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await changePassword.HandleAsync(body ?? ChangePasswordRequest.Empty, cancellationToken).ConfigureAwait(false);
        if (result is { IsFailure: true, Error.Code: ProfileErrors.PasswordLockedCode })
        {
            // A 429 is not stored, so the gate would roll back the wrong password that just locked the account.
            IdempotencyOutcome.KeepChanges(HttpContext);
        }

        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Asks to change the caller's sign-in email. A confirmation link goes to the new address and a notice to the current one; the
    /// sign-in email changes only when the link is confirmed.
    /// </summary>
    /// <param name="body">The new email and the current password; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the profile and its pending email, 400 for field errors (a wrong current password is one), 401 without a valid token, 409 when two saves lost a race, or 429 <c>profile.password-locked</c> (with Retry-After) while the account is locked.</returns>
    [HttpPost("email-change")]
    [EnableRateLimiting(RateLimitPolicies.Reset)]
    [EndpointName("RequestEmailChange")]
    [ProducesResponseType<ProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> RequestEmailChange(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] RequestEmailChangeRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await requestEmailChange.HandleAsync(body ?? RequestEmailChangeRequest.Empty, cancellationToken).ConfigureAwait(false);
        if (result is { IsFailure: true, Error.Code: ProfileErrors.PasswordLockedCode })
        {
            // A 429 is not stored, so the gate would roll back the wrong password that just locked the account.
            IdempotencyOutcome.KeepChanges(HttpContext);
        }

        return result.ToHttpResult(HttpContext, static profile => TypedResults.Ok(profile));
    }

    /// <summary>
    /// Confirms an email change from the emailed link. Anonymous: the link is the proof, so the person need not be signed in. The
    /// token travels in the body, never in a URL.
    /// </summary>
    /// <param name="body">The token; a null or unreadable body reads as an invalid link.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the new sign-in email, 404 <c>email-change.invalid</c> for any link that does not work, or 409 when two saves lost a race.</returns>
    [HttpPost("email-change/confirm")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Reset)]
    [EndpointName("ConfirmEmailChange")]
    [ProducesResponseType<EmailChangeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> ConfirmEmailChange(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] EmailChangeTokenRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await confirmEmailChange.HandleAsync(body ?? EmailChangeTokenRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
    }

    /// <summary>
    /// Tells the confirm-email page whether its link still works and which address it would confirm. Anonymous and read-only: it
    /// spends nothing and changes nothing, so a mail scanner opening the link confirms nothing. The token travels in the body.
    /// </summary>
    /// <param name="body">The token; a null or unreadable body reads as an invalid link.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the address the link would confirm, or 404 <c>email-change.invalid</c> for any link that does not work.</returns>
    [HttpPost("email-change/check")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Reset)]
    [IdempotencyExempt("Read-only lookup; changes nothing.")]
    [EndpointName("CheckEmailChange")]
    [ProducesResponseType<EmailChangeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> CheckEmailChange(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] EmailChangeTokenRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await checkEmailChange.HandleAsync(body ?? EmailChangeTokenRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
    }
}

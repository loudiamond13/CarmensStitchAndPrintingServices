using Csps.Application.Auth;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// Password recovery by email (AUTH-08, AUTH-09, D-16, D-17). Anonymous and never cached. The answers never say whether
/// an account exists, and the reset token travels in the body, never in a URL.
/// </summary>
/// <param name="forgotPassword">The forgot-password handler.</param>
/// <param name="checkResetLink">The reset-link check handler.</param>
/// <param name="resetPassword">The reset handler.</param>
[ApiController]
[Route("api/v1/auth/password")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class PasswordController(
    ForgotPasswordHandler forgotPassword,
    CheckResetLinkHandler checkResetLink,
    ResetPasswordHandler resetPassword) : ControllerBase
{
    /// <summary>Emails a reset link when the address belongs to an active staff account. Every well-formed address gets the same answer.</summary>
    /// <param name="body">The form; a null or unreadable body is reported as a field error.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>202 with no body, or 400 for a missing or malformed email.</returns>
    [HttpPost("forgot")]
    [EndpointName("ForgotPassword")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IResult> Forgot(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ForgotPasswordRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await forgotPassword.HandleAsync(body ?? ForgotPasswordRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.Accepted((string?)null));
    }

    /// <summary>Tells the reset page whether its link still works and which account it is for.</summary>
    /// <param name="body">The token; a null or unreadable body reads as an invalid link.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the account email, or 404 <c>auth.link-invalid</c> for any link that does not work.</returns>
    [HttpPost("reset/check")]
    [IdempotencyExempt("Read-only lookup; changes nothing.")]
    [EndpointName("CheckResetLink")]
    [ProducesResponseType<ResetLinkResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> CheckLink(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ResetTokenRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await checkResetLink.HandleAsync(body ?? ResetTokenRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
    }

    /// <summary>Sets a new password from a reset link. It ends every session and signs nobody in.</summary>
    /// <param name="body">The token and the new password; a null or unreadable body is reported as a field error.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204 with no body, 400 for a refused password, 404 <c>auth.link-invalid</c>, or 409 when two saves lost a race.</returns>
    [HttpPost("reset")]
    [EndpointName("ResetPassword")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Reset(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ResetPasswordRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await resetPassword.HandleAsync(body ?? ResetPasswordRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }
}

using Csps.Application.Auth;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// Password recovery by email (AUTH-08, D-16). Anonymous and never cached. The answer never says whether an account
/// exists.
/// </summary>
/// <param name="forgotPassword">The forgot-password handler.</param>
[ApiController]
[Route("api/v1/auth/password")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class PasswordController(ForgotPasswordHandler forgotPassword) : ControllerBase
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
}

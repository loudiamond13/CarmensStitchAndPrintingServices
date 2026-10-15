using Csps.Application.Auth;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>What a successful sign-in step answers: how long to wait before asking for a new code.</summary>
/// <param name="ResendAfterSeconds">Whole seconds.</param>
public sealed record SignInResponse(int ResendAfterSeconds);

/// <summary>
/// Staff sign-in, first step: email and password in, a code by email and the pending-login cookie out (AUTH-01,
/// AUTH-02). Anonymous and never cached. The code step joins this route prefix in a later plan.
/// </summary>
/// <param name="handler">The use-case handler.</param>
[ApiController]
[Route("api/v1/auth")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SignInController(SignInHandler handler) : ControllerBase
{
    /// <summary>Checks the email and password and sends the sign-in code.</summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the resend wait and the ticket cookie, 400 for field errors, or the one generic 401.</returns>
    [HttpPost("sign-in")]
    [EndpointName("SignIn")]
    [ProducesResponseType<SignInResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> SignIn(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] SignInRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(body ?? SignInRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, outcome =>
        {
            AuthCookies.SetTicket(Response, outcome.Ticket, outcome.TicketExpiresAt);
            return TypedResults.Ok(new SignInResponse(outcome.ResendAfterSeconds));
        });
    }
}

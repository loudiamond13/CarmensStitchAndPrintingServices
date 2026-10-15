using Csps.Application.Auth;
using Csps.Domain.Identity;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>What a successful sign-in step answers: how long to wait before asking for a new code.</summary>
/// <param name="ResendAfterSeconds">Whole seconds.</param>
public sealed record SignInResponse(int ResendAfterSeconds);

/// <summary>What a correct code answers: the next step and, when signed in, the session.</summary>
/// <param name="Next">Either <c>signed-in</c> or <c>set-new-password</c>.</param>
/// <param name="Reason">Why a new password is needed (<c>temporary</c> or <c>breach</c>); null when signed in.</param>
/// <param name="Session">The started session; null when a new password is needed.</param>
public sealed record VerifyCodeResponse(string Next, string? Reason, SessionResponse? Session);

/// <summary>
/// Staff sign-in: email and password in, a code by email and the pending-login cookie out (AUTH-01, AUTH-02), then
/// the emailed code in and a session out. Anonymous and never cached; the code step reads the pending-login cookie
/// and so needs the anti-CSRF header.
/// </summary>
/// <param name="signIn">The first-step handler.</param>
/// <param name="verifyCode">The code-step handler.</param>
[ApiController]
[Route("api/v1/auth")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SignInController(SignInHandler signIn, VerifyCodeHandler verifyCode) : ControllerBase
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
        var result = await signIn.HandleAsync(body ?? SignInRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, outcome =>
        {
            AuthCookies.SetTicket(Response, outcome.Ticket, outcome.TicketExpiresAt);
            return TypedResults.Ok(new SignInResponse(outcome.ResendAfterSeconds));
        });
    }

    /// <summary>Checks the emailed code and starts the session, or hands over to the set-new-password step.</summary>
    /// <param name="body">The code form; a null or unreadable body is reported as a field error.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>
    /// 200 with the next step (and the refresh cookie when signed in), 400 for a code error, 401 when the pending
    /// sign-in timed out, 403 without the anti-CSRF header, or 429 when the account is paused.
    /// </returns>
    [HttpPost("two-factor/verify")]
    [RequireCsrfHeader]
    [EndpointName("VerifyCode")]
    [ProducesResponseType<VerifyCodeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> VerifyCode(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] VerifyCodeRequest? body,
        CancellationToken cancellationToken)
    {
        var ticket = Request.Cookies[AuthCookies.TicketCookieName];
        var result = await verifyCode.HandleAsync(ticket, body ?? VerifyCodeRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, outcome =>
        {
            if (outcome.Next == VerifyNext.SetNewPassword)
            {
                return TypedResults.Ok(new VerifyCodeResponse("set-new-password", ReasonText(outcome.Reason), null));
            }

            var issued = outcome.Session!;
            AuthCookies.ClearTicket(Response);
            AuthCookies.SetRefresh(Response, issued.RefreshToken, issued.CookieExpiresAt);
            return TypedResults.Ok(new VerifyCodeResponse("signed-in", null, issued.Response));
        });
    }

    private static string? ReasonText(PasswordChangeReason? reason) => reason switch
    {
        PasswordChangeReason.Temporary => "temporary",
        PasswordChangeReason.Breach => "breach",
        _ => null,
    };
}

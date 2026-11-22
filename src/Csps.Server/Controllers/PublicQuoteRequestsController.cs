using Csps.Application.QuoteRequests;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The public "Get a Quote" form (INQ-01): anonymous visitors send a quote request. Never cached. A visitor has no account, so the
/// saved request has no creator (SEC-08).
/// </summary>
/// <param name="create">The create-a-request handler.</param>
[ApiController]
[Route("api/v1/public/quote-requests")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class PublicQuoteRequestsController(CreateQuoteRequestHandler create) : ControllerBase
{
    /// <summary>
    /// Saves a quote request. The name and a Philippine mobile number are required; every other field is optional. The request is
    /// saved at status New. Who made it, when, its status and any order link come from the server, so any such member in the body
    /// is ignored. A retry with the same <c>Idempotency-Key</c> and body answers with the stored 200 and saves nothing more.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the id of the new request, 400 for field errors, or 429 when the address sends too many.</returns>
    [HttpPost]
    [EndpointName("CreateQuoteRequest")]
    [ProducesResponseType<CreateQuoteRequestResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateQuoteRequestRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(body ?? CreateQuoteRequestRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
    }
}

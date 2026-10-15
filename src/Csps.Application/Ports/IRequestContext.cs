using System.Net;

namespace Csps.Application.Ports;

/// <summary>
/// Facts about the current request that Application code may record, for example in the audit trail (FND-07,
/// FND-10). Values come from the direct connection only: proxy headers such as <c>X-Forwarded-For</c> are ignored
/// until the FND-13 hosting record proves which proxy sits in front of the site, because a client can forge them.
/// Outside a request (a background job) the user, address and user agent are absent.
/// </summary>
public interface IRequestContext
{
    /// <summary>Gets the signed-in user's id from the <c>sub</c> claim, or <see langword="null"/> when anonymous.</summary>
    Guid? UserId { get; }

    /// <summary>
    /// Gets the caller's own session id from the <c>sid</c> claim ("this device"), or <see langword="null"/> when
    /// there is no valid claim or outside a request.
    /// </summary>
    Guid? SessionId { get; }

    /// <summary>
    /// Gets the remote address of the direct connection. It is personal data: store it only in minimized form
    /// (the audit trail keeps a /24 or /48 prefix, D-24) and never write it to application logs.
    /// </summary>
    IPAddress? RemoteIp { get; }

    /// <summary>Gets the raw <c>User-Agent</c> header. Store only its family (D-24) and never log it.</summary>
    string? UserAgent { get; }

    /// <summary>
    /// Gets the id that ties this work to its log lines: the request's W3C trace id (32 lowercase hex characters),
    /// the same value the client sees as <c>traceId</c>.
    /// </summary>
    string CorrelationId { get; }
}

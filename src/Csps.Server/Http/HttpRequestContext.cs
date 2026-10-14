using System.Diagnostics;
using System.Net;
using Csps.Application.Ports;

namespace Csps.Server.Http;

/// <summary>
/// <see cref="IRequestContext"/> read from the current <see cref="HttpContext"/>. The address is
/// <c>Connection.RemoteIpAddress</c> only: proxy headers (<c>X-Forwarded-For</c>, <c>X-Real-IP</c>,
/// <c>CF-Connecting-IP</c>) are never read until the FND-13 hosting record proves the proxy topology, because a
/// client can forge them (research Pitfall 17). The user id is the raw <c>sub</c> claim (inbound claim mapping stays
/// off). Registered as scoped.
/// </summary>
/// <param name="accessor">Gives access to the current request, if any.</param>
public sealed class HttpRequestContext(IHttpContextAccessor accessor) : IRequestContext
{
    private const string SubjectClaimType = "sub";

    private readonly Lazy<string> _backgroundCorrelationId = new(NewBackgroundCorrelationId);

    /// <inheritdoc />
    public Guid? UserId =>
        Guid.TryParse(Current?.User.FindFirst(SubjectClaimType)?.Value, out var userId) ? userId : null;

    /// <inheritdoc />
    public IPAddress? RemoteIp => Current?.Connection.RemoteIpAddress;

    /// <inheritdoc />
    public string? UserAgent => Current?.Request.Headers.UserAgent.ToString() is { Length: > 0 } userAgent ? userAgent : null;

    /// <inheritdoc />
    public string CorrelationId => Current is { } context
        ? Http.CorrelationId.For(context)
        : _backgroundCorrelationId.Value;

    private HttpContext? Current => accessor.HttpContext;

    // Outside a request: the ambient trace id if work runs under an Activity, otherwise a fresh W3C-format id that
    // stays the same for this scope.
    private static string NewBackgroundCorrelationId() =>
        (Activity.Current?.TraceId ?? ActivityTraceId.CreateRandom()).ToHexString();
}

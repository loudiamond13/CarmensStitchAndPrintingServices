using System.Net;
using Csps.Application.Ports;

namespace Csps.Server.Http;

/// <summary>Compile-only stub (TDD RED).</summary>
/// <param name="accessor">The HTTP context accessor.</param>
public sealed class HttpRequestContext(IHttpContextAccessor accessor) : IRequestContext
{
    /// <inheritdoc />
    public Guid? UserId => accessor is null ? null : null;

    /// <inheritdoc />
    public IPAddress? RemoteIp => null;

    /// <inheritdoc />
    public string? UserAgent => null;

    /// <inheritdoc />
    public string CorrelationId => string.Empty;
}

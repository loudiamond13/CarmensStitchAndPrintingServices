using System.Diagnostics;
using System.Net;
using Csps.Application.Ports;

namespace Csps.Infrastructure.Seeding;

/// <summary>
/// <see cref="IRequestContext"/> for work a tool does outside any request, such as <c>bootstrap-manager</c>: no user,
/// no address, no session and no user agent, so audits record the System actor. The correlation id is a random W3C
/// trace id, fixed for the life of the instance.
/// </summary>
public sealed class SystemRequestContext : IRequestContext
{
    /// <inheritdoc />
    public Guid? UserId => null;

    /// <inheritdoc />
    public Guid? SessionId => null;

    /// <inheritdoc />
    public IPAddress? RemoteIp => null;

    /// <inheritdoc />
    public string? UserAgent => null;

    /// <inheritdoc />
    public string CorrelationId { get; } = ActivityTraceId.CreateRandom().ToHexString();
}

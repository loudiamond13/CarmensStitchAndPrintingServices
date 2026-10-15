using System.Net;
using Csps.Application.Ports;

namespace Csps.Infrastructure.IntegrationTests.Auditing;

/// <summary>
/// A test <see cref="IRequestContext"/> with settable values. The default correlation id is fresh for every
/// instance, so audit assertions can find exactly their own rows (Respawn never resets the audit log).
/// </summary>
public sealed class FixedRequestContext : IRequestContext
{
    /// <summary>A desktop Chrome User-Agent; classified as the family "Chrome".</summary>
    public const string ChromeUserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

    /// <inheritdoc />
    public Guid? UserId { get; set; }

    /// <inheritdoc />
    public Guid? SessionId { get; set; }

    /// <inheritdoc />
    public IPAddress? RemoteIp { get; set; }

    /// <inheritdoc />
    public string? UserAgent { get; set; }

    /// <inheritdoc />
    public string CorrelationId { get; set; } = NewCorrelationId();

    /// <summary>Returns a fresh W3C-style id: 32 lowercase hex characters.</summary>
    /// <returns>The new id.</returns>
    public static string NewCorrelationId() => Guid.NewGuid().ToString("N");
}

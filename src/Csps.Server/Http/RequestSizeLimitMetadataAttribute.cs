using Microsoft.AspNetCore.Http.Metadata;

namespace Csps.Server.Http;

/// <summary>
/// Raises the request body limit of one action (IMG-02). It is metadata only: the routing middleware and <see cref="RequestBodyLimitMiddleware"/>
/// read it. The framework's <c>[RequestSizeLimit]</c> also adds a filter, which logs a warning on every call when the idempotency
/// middleware has already read the body.
/// </summary>
/// <param name="bytes">The largest accepted request body in bytes.</param>
[AttributeUsage(AttributeTargets.Method)]
public sealed class RequestSizeLimitMetadataAttribute(long bytes) : Attribute, IRequestSizeLimitMetadata
{
    /// <inheritdoc />
    public long? MaxRequestBodySize { get; } = bytes;
}

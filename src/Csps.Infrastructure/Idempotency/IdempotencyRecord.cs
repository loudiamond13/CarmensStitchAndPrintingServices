namespace Csps.Infrastructure.Idempotency;

/// <summary>
/// The stored answer to a state-changing POST (SEC-06, D-40), kept 24 hours so a repeat with the same Idempotency-Key
/// gets it back. It commits in the same transaction as the business change. Relational columns only, no JSON.
/// </summary>
public sealed class IdempotencyRecord
{
    /// <summary>The longest route stored: the method and the route pattern.</summary>
    public const int RouteMaxLength = 200;

    /// <summary>The longest content type stored.</summary>
    public const int ContentTypeMaxLength = 100;

    /// <summary>The longest Location stored.</summary>
    public const int LocationMaxLength = 2048;

    /// <summary>How long a key is remembered.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(24);

    private IdempotencyRecord()
    {
        Route = string.Empty;
        RequestHash = [];
    }

    /// <summary>Gets the row id.</summary>
    public long Id { get; private set; }

    /// <summary>Gets the client's request key.</summary>
    public Guid Key { get; private set; }

    /// <summary>Gets the signed-in user, or null for an anonymous caller.</summary>
    public Guid? UserId { get; private set; }

    /// <summary>Gets the method and route pattern, for example <c>POST /api/v1/auth/password/forgot</c>.</summary>
    public string Route { get; private set; }

    /// <summary>Gets the SHA-256 of the request body.</summary>
    public byte[] RequestHash { get; private set; }

    /// <summary>Gets the stored HTTP status.</summary>
    public int StatusCode { get; private set; }

    /// <summary>Gets the stored response body; null when it was empty.</summary>
    public string? ResponseBody { get; private set; }

    /// <summary>Gets the stored Content-Type; null when there was no body.</summary>
    public string? ResponseContentType { get; private set; }

    /// <summary>Gets the stored Location header, if any.</summary>
    public string? Location { get; private set; }

    /// <summary>Gets when the answer was stored.</summary>
    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>Gets the moment the key stops matching (24 hours after <see cref="CreatedAt"/>).</summary>
    public DateTimeOffset ExpiresAt { get; private set; }

    /// <summary>Creates a record for an answer about to be stored.</summary>
    /// <param name="key">The request key.</param>
    /// <param name="userId">The signed-in user, or null.</param>
    /// <param name="route">The method and route pattern.</param>
    /// <param name="requestHash">The SHA-256 of the request body.</param>
    /// <param name="statusCode">The HTTP status.</param>
    /// <param name="body">The response body, or null when empty.</param>
    /// <param name="contentType">The response Content-Type, or null.</param>
    /// <param name="location">The Location header, or null.</param>
    /// <param name="now">The current UTC time.</param>
    /// <returns>The new record.</returns>
    public static IdempotencyRecord Create(
        Guid key, Guid? userId, string route, byte[] requestHash, int statusCode, string? body, string? contentType, string? location, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(route);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(route.Length, RouteMaxLength);
        ArgumentNullException.ThrowIfNull(requestHash);

        return new IdempotencyRecord
        {
            Key = key,
            UserId = userId,
            Route = route,
            RequestHash = requestHash,
            StatusCode = statusCode,
            ResponseBody = string.IsNullOrEmpty(body) ? null : body,
            ResponseContentType = Truncate(contentType, ContentTypeMaxLength),
            Location = Truncate(location, LocationMaxLength),
            CreatedAt = now,
            ExpiresAt = now + Lifetime,
        };
    }

    private static string? Truncate(string? value, int maxLength) =>
        value is null || value.Length <= maxLength ? value : value[..maxLength];
}

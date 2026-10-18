using System.Buffers;
using System.Security.Cryptography;
using System.Text;
using Csps.Application.Ports;
using Csps.Infrastructure.Idempotency;
using Csps.Server.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Security;

/// <summary>
/// Default-on Idempotency-Key handling for every POST (SEC-06, D-40). A POST must carry a UUID key. The key is scoped
/// to the route and the user (none when anonymous): a repeat with the same path, query and body gets the stored answer with
/// <c>Idempotent-Replayed: true</c>, a different one is a 422, and a duplicate that arrives while the first runs is a
/// 409. The answer is stored with the business change in one transaction and written to the client only after the
/// commit. Only 2xx, 400, 404 and 422 are kept; anything else rolls back so the same key may run again, unless the
/// endpoint calls <see cref="IdempotencyOutcome.KeepChanges"/>: then the change commits and the answer is still not stored.
/// Multipart bodies will need part-wise hashing once uploads exist (deferred LIB-CR-02).
/// </summary>
/// <param name="next">The next middleware.</param>
/// <param name="clock">The UTC clock.</param>
public sealed class IdempotencyMiddleware(RequestDelegate next, TimeProvider clock)
{
    /// <summary>The request header that carries the key.</summary>
    public const string KeyHeader = "Idempotency-Key";

    /// <summary>The response header that marks a stored answer sent again.</summary>
    public const string ReplayedHeader = "Idempotent-Replayed";

    /// <summary>Machine code: the key is missing or not a UUID.</summary>
    public const string KeyMissingCode = "idempotency.key-missing";

    /// <summary>Machine code: the key was used with a different body.</summary>
    public const string KeyMismatchCode = "idempotency.key-mismatch";

    /// <summary>Machine code: the same key is still being processed.</summary>
    public const string InProgressCode = "idempotency.in-progress";

    /// <summary>The largest response body that is stored; a bigger answer is sent but not kept.</summary>
    public const int MaxStoredBodyBytes = 1_048_576;

    private const string KeyMissingMessage = "This form needs a fresh request key. Reload and try again.";
    private const string KeyMismatchMessage = "This request key was already used for something else. Reload and try again.";
    private const string InProgressMessage = "This request is already being processed. Wait a moment, then check the result.";
    private const string NoStore = "no-store";

    /// <summary>Runs the request through the gate when it is a covered POST.</summary>
    /// <param name="context">The current HTTP context.</param>
    /// <param name="gate">The scoped gate.</param>
    /// <param name="requestContext">The request facts (the signed-in user).</param>
    /// <returns>A task that completes when the response is written.</returns>
    public async Task InvokeAsync(HttpContext context, IdempotencyGate gate, IRequestContext requestContext)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(gate);
        ArgumentNullException.ThrowIfNull(requestContext);

        if (!TryGetCoveredRoute(context, out var route))
        {
            await next(context).ConfigureAwait(false);
            return;
        }

        if (!TryReadKey(context.Request, out var key))
        {
            await WriteProblemAsync(context, StatusCodes.Status400BadRequest, KeyMissingMessage, KeyMissingCode).ConfigureAwait(false);
            return;
        }

        var requestHash = await HashRequestAsync(context.Request, context.RequestAborted).ConfigureAwait(false);
        if (requestHash is null)
        {
            // A chunked body has no declared length for the body-limit middleware to refuse; it is counted here.
            await CspsProblemDetails.WriteAsync(context, StatusCodes.Status413PayloadTooLarge).ConfigureAwait(false);
            return;
        }

        var lease = await gate.BeginAsync(key, route, requestContext.UserId, requestHash, clock.GetUtcNow(), context.RequestAborted).ConfigureAwait(false);
        await using (lease.ConfigureAwait(false))
        {
            switch (lease.State)
            {
                case IdempotencyLeaseState.Busy:
                    await WriteProblemAsync(context, StatusCodes.Status409Conflict, InProgressMessage, InProgressCode).ConfigureAwait(false);
                    return;
                case IdempotencyLeaseState.Mismatch:
                    await WriteProblemAsync(context, StatusCodes.Status422UnprocessableEntity, KeyMismatchMessage, KeyMismatchCode).ConfigureAwait(false);
                    return;
                case IdempotencyLeaseState.Replay:
                    await ReplayAsync(context, lease.Replay!).ConfigureAwait(false);
                    return;
                default:
                    await RunAndStoreAsync(context, lease).ConfigureAwait(false);
                    return;
            }
        }
    }

    // Only endpoints that name POST are covered: the /api fallback matches every method and is not a form post.
    private static bool TryGetCoveredRoute(HttpContext context, out string route)
    {
        route = string.Empty;
        if (!HttpMethods.IsPost(context.Request.Method) || context.GetEndpoint() is not RouteEndpoint endpoint)
        {
            return false;
        }

        var methods = endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods;
        if (methods is null || !methods.Contains(HttpMethods.Post, StringComparer.OrdinalIgnoreCase)
            || endpoint.Metadata.GetMetadata<IdempotencyExemptAttribute>() is not null)
        {
            return false;
        }

        // Controller attribute routes report no leading slash; the key uses one, like the authorization matrix.
        var pattern = endpoint.RoutePattern.RawText ?? string.Empty;
        route = $"POST {(pattern.StartsWith('/') ? pattern : "/" + pattern)}";
        return true;
    }

    private static bool TryReadKey(HttpRequest request, out Guid key)
    {
        key = Guid.Empty;
        var values = request.Headers[KeyHeader];
        return values.Count == 1 && Guid.TryParseExact(values[0], "D", out key);
    }

    // The hash covers the concrete target (path and query) and the body, so one key cannot replay an answer for another resource.
    // Null when the body is over the limit, counted here so the answer is a 413 and not the buffer's own exception.
    private static async Task<byte[]?> HashRequestAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        const int ReadSize = 8192;

        // The body is read here and again by the action, so it is buffered in memory; the buffer limit sits above the
        // counted limit, so the count always trips first.
        request.EnableBuffering((int)RequestBodyLimitMiddleware.MaxBytes, RequestBodyLimitMiddleware.MaxBytes + ReadSize);
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);

        // Length-prefixed, so the target cannot blur into the body bytes that follow.
        var target = Encoding.UTF8.GetBytes($"{request.Path}{request.QueryString}");
        hash.AppendData(BitConverter.GetBytes(target.Length));
        hash.AppendData(target);

        var buffer = ArrayPool<byte>.Shared.Rent(ReadSize);
        try
        {
            long total = 0;
            int read;
            while ((read = await request.Body.ReadAsync(buffer.AsMemory(0, ReadSize), cancellationToken).ConfigureAwait(false)) > 0)
            {
                total += read;
                if (total > RequestBodyLimitMiddleware.MaxBytes)
                {
                    return null;
                }

                hash.AppendData(buffer, 0, read);
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }

        request.Body.Position = 0;
        return hash.GetHashAndReset();
    }

    private static async Task ReplayAsync(HttpContext context, StoredResponse stored)
    {
        var response = context.Response;
        response.StatusCode = stored.StatusCode;
        response.Headers.CacheControl = NoStore;
        response.Headers[ReplayedHeader] = "true";
        if (stored.Location is not null)
        {
            response.Headers.Location = stored.Location;
        }

        if (!string.IsNullOrEmpty(stored.Body))
        {
            response.ContentType = stored.ContentType;
            await response.WriteAsync(stored.Body, Encoding.UTF8, context.RequestAborted).ConfigureAwait(false);
        }
    }

    // The business change and the stored answer commit together; the client sees the answer only after that.
    private async Task RunAndStoreAsync(HttpContext context, IdempotencyLease lease)
    {
        var original = context.Response.Body;
        var buffer = new MemoryStream();
        await using (buffer.ConfigureAwait(false))
        {
            context.Response.Body = buffer;
            try
            {
                await next(context).ConfigureAwait(false);
                await context.Response.BodyWriter.FlushAsync(context.RequestAborted).ConfigureAwait(false);
            }
            finally
            {
                context.Response.Body = original;
            }

            // Not tied to the request: once the work is done, the record is stored even if the client has gone.
            if (IsStorable(context.Response, buffer.Length))
            {
                var body = buffer.Length == 0 ? null : Encoding.UTF8.GetString(buffer.GetBuffer(), 0, (int)buffer.Length);
                var location = context.Response.Headers.Location.ToString();
                await lease.StoreAndCommitAsync(
                    context.Response.StatusCode,
                    body,
                    context.Response.ContentType,
                    location.Length == 0 ? null : location,
                    CancellationToken.None).ConfigureAwait(false);
            }
            else if (IdempotencyOutcome.ChangesKept(context))
            {
                await lease.CommitWithoutRecordAsync(CancellationToken.None).ConfigureAwait(false);
            }
            else
            {
                await lease.RollbackAsync(CancellationToken.None).ConfigureAwait(false);
            }

            if (buffer.Length > 0)
            {
                context.Response.ContentLength = buffer.Length;
                await original.WriteAsync(buffer.GetBuffer().AsMemory(0, (int)buffer.Length), context.RequestAborted).ConfigureAwait(false);
            }
        }
    }

    // Stored: 2xx and the input errors 400, 404 and 422. Never 401, 403, 409, 429 or 5xx, which may succeed on a retry.
    // Never a response that sets a cookie (a session or ticket), a body over 1 MB, or a body that is not text.
    private static bool IsStorable(HttpResponse response, long bodyLength)
    {
        var status = response.StatusCode;
        var statusKept = status is >= StatusCodes.Status200OK and < 300
            or StatusCodes.Status400BadRequest
            or StatusCodes.Status404NotFound
            or StatusCodes.Status422UnprocessableEntity;
        return statusKept
            && bodyLength <= MaxStoredBodyBytes
            && !response.Headers.ContainsKey(HeaderNames.SetCookie)
            && (bodyLength == 0 || IsText(response.ContentType));
    }

    private static bool IsText(string? contentType) =>
        MediaTypeHeaderValue.TryParse(contentType, out var parsed)
        && parsed.MediaType.HasValue
        && (parsed.MediaType.Value.StartsWith("text/", StringComparison.OrdinalIgnoreCase)
            || parsed.MediaType.Value.EndsWith("json", StringComparison.OrdinalIgnoreCase));

    private static Task WriteProblemAsync(HttpContext context, int status, string detail, string code)
    {
        context.Response.Headers.CacheControl = NoStore;
        return TypedResults.Problem(CspsProblemDetails.Build(context, status, detail, code: code)).ExecuteAsync(context);
    }
}

/// <summary>
/// Lets an endpoint keep its database changes when its answer is not one the gate stores. A 429 for a locked account
/// is the case: the wrong password that locks the account must stay counted, but a retry may still get another answer.
/// </summary>
public static class IdempotencyOutcome
{
    private static readonly object KeepKey = new();

    /// <summary>Commits this request's changes without storing its answer, so the same key may run again.</summary>
    /// <param name="context">The current HTTP context.</param>
    public static void KeepChanges(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        context.Items[KeepKey] = true;
    }

    internal static bool ChangesKept(HttpContext context) => context.Items.ContainsKey(KeepKey);
}

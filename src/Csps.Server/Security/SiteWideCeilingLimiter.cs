using System.Threading.RateLimiting;

namespace Csps.Server.Security;

/// <summary>
/// Wraps the site-wide page view limiter and marks the request it refuses, so the 429 can say the site is busy rather than
/// blame the visitor's address. Permits and windows are the inner limiter's own.
/// </summary>
internal sealed class SiteWideCeilingLimiter(PartitionedRateLimiter<HttpContext> inner) : PartitionedRateLimiter<HttpContext>
{
    private static readonly object RefusedKey = new();

    /// <summary>True when the last ceiling answer for the request was a refusal.</summary>
    /// <param name="context">The request.</param>
    /// <returns>Whether the site-wide ceiling refused it.</returns>
    internal static bool Refused(HttpContext context) => context.Items.ContainsKey(RefusedKey);

    public override RateLimiterStatistics? GetStatistics(HttpContext resource) => inner.GetStatistics(resource);

    protected override RateLimitLease AttemptAcquireCore(HttpContext resource, int permitCount) =>
        Mark(resource, inner.AttemptAcquire(resource, permitCount));

    protected override async ValueTask<RateLimitLease> AcquireAsyncCore(
        HttpContext resource, int permitCount, CancellationToken cancellationToken) =>
        Mark(resource, await inner.AcquireAsync(resource, permitCount, cancellationToken).ConfigureAwait(false));

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            inner.Dispose();
        }

        base.Dispose(disposing);
    }

    protected override async ValueTask DisposeAsyncCore()
    {
        await inner.DisposeAsync().ConfigureAwait(false);
        await base.DisposeAsyncCore().ConfigureAwait(false);
    }

    private static RateLimitLease Mark(HttpContext context, RateLimitLease lease)
    {
        if (lease.IsAcquired)
        {
            context.Items.Remove(RefusedKey);
        }
        else
        {
            context.Items[RefusedKey] = true;
        }

        return lease;
    }
}

using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Threading.RateLimiting;
using Csps.Server.Http;
using Microsoft.AspNetCore.RateLimiting;

namespace Csps.Server.Security;

/// <summary>
/// Per-address limits on the auth endpoints (SEC-03, D-39, CWE-307, CWE-799). A rejected request is answered by the
/// limiter itself, so it never reaches a handler: no database work, no audit entry, no email.
/// </summary>
public static class RateLimitingRegistration
{
    /// <summary>The machine code a limiter rejection carries.</summary>
    public const string RateLimitedCode = "rate-limited";

    private const string UnknownAddressKey = "unknown";
    private const int SegmentsPerWindow = 6;
    private const int IPv6PrefixBytes = 8;

    /// <summary>
    /// Adds the six auth policies. The address is read from <c>Connection.RemoteIpAddress</c> only, until the hosting
    /// record proves the proxy topology (D-39, Phase 3); behind a shared proxy every visitor would share one bucket.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The host configuration.</param>
    /// <returns>The same service collection.</returns>
    /// <exception cref="InvalidOperationException">A setting is not usable; the message names the setting, never a value.</exception>
    public static IServiceCollection AddCspsRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var settings = configuration.GetSection(RateLimitSettings.SectionName).Get<RateLimitSettings>() ?? new RateLimitSettings();
        var problems = settings.Validate();
        if (problems.Count > 0)
        {
            throw new InvalidOperationException(string.Join(" ", problems));
        }

        var windows = new Dictionary<string, TimeSpan>(StringComparer.Ordinal)
        {
            [RateLimitPolicies.SignIn] = settings.SignIn.Window,
            [RateLimitPolicies.Verify] = settings.Verify.Window,
            [RateLimitPolicies.Resend] = settings.Resend.Window,
            [RateLimitPolicies.Forgot] = settings.Forgot.Window,
            [RateLimitPolicies.Reset] = settings.Reset.Window,
            [RateLimitPolicies.Refresh] = settings.Refresh.Window,
        };

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = (context, cancellationToken) => WriteRejectionAsync(context, windows, cancellationToken);
            AddPolicy(options, RateLimitPolicies.SignIn, settings.SignIn);
            AddPolicy(options, RateLimitPolicies.Verify, settings.Verify);
            AddPolicy(options, RateLimitPolicies.Resend, settings.Resend);
            AddPolicy(options, RateLimitPolicies.Forgot, settings.Forgot);
            AddPolicy(options, RateLimitPolicies.Reset, settings.Reset);
            AddPolicy(options, RateLimitPolicies.Refresh, settings.Refresh);
        });
        return services;
    }

    /// <summary>
    /// Builds the bucket key for a client address: the full IPv4 address, the first 64 bits of an IPv6 address (one host
    /// owns a /64), or a shared key when there is no address. The set of keys is bounded by the address space.
    /// </summary>
    /// <param name="address">The connection's remote address, or null.</param>
    /// <returns>The partition key.</returns>
    public static string PartitionKey(IPAddress? address)
    {
        if (address is null)
        {
            return UnknownAddressKey;
        }

        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        if (address.AddressFamily != AddressFamily.InterNetworkV6)
        {
            return address.ToString();
        }

        Span<byte> bytes = stackalloc byte[16];
        if (!address.TryWriteBytes(bytes, out _))
        {
            return UnknownAddressKey;
        }

        bytes[IPv6PrefixBytes..].Clear();
        return $"{new IPAddress(bytes)}/64";
    }

    private static void AddPolicy(RateLimiterOptions options, string name, RateLimitRule rule) =>
        options.AddPolicy(name, context => RateLimitPartition.GetSlidingWindowLimiter(
            PartitionKey(context.Connection.RemoteIpAddress),
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = rule.PermitLimit,
                Window = rule.Window,
                SegmentsPerWindow = SegmentsPerWindow,
                QueueLimit = 0,
                AutoReplenishment = true,
            }));

    private static async ValueTask WriteRejectionAsync(
        OnRejectedContext context, Dictionary<string, TimeSpan> windows, CancellationToken cancellationToken)
    {
        var http = context.HttpContext;
        var policy = http.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;

        // A sliding window reports no wait, so the policy's whole window is the safe answer: after it, every earlier
        // request has left the window. Whole seconds, rounded up and never below 1 (SEC-03 precision edge).
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var wait)
            || (policy is not null && windows.TryGetValue(policy, out wait)))
        {
            var seconds = Math.Max(1, (int)Math.Ceiling(wait.TotalSeconds));
            http.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
        }

        var problem = CspsProblemDetails.Build(
            http, StatusCodes.Status429TooManyRequests, "Too many attempts from this address. Please wait and try again.", code: RateLimitedCode);
        await TypedResults.Problem(problem).ExecuteAsync(http).ConfigureAwait(false);
    }
}

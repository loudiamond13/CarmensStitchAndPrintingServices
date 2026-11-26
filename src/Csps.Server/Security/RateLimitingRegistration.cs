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

    /// <summary>The endpoint name the site-wide page view ceiling keys on. The page view action takes its name from it.</summary>
    public const string PageViewEndpointName = "RecordPageView";

    /// <summary>The endpoint name the quote create limits key on. The create action takes its name from it.</summary>
    public const string QuoteCreateEndpointName = "CreateQuoteRequest";

    internal const string UploadsBusyDetail = "Too many uploads right now. Wait a minute, then try again.";
    internal const string SiteBusyDetail = "The site is busy. Please try again in a minute.";
    private const string AttemptsDetail = "Too many attempts from this address. Please wait and try again.";
    private const string UnknownAddressKey = "unknown";
    private const string PageViewSitePartitionKey = "analytics-site";
    private const string QuoteSitePartitionKey = "quote-site";
    private const string NoSiteWideLimitKey = "no-site-wide-limit";
    private const int SegmentsPerWindow = 6;
    private const int IPv6PrefixBytes = 8;

    /// <summary>
    /// Adds the six auth policies, the maintenance policy, the photo upload policy, the <c>public-read</c> policy, the
    /// <c>analytics-collect</c> policy and the <c>quote-alerts-test</c> policy (D-11).
    /// It also adds the <c>quote-create</c> policy and one site-wide limit on each of the page view route (<c>RateLimits:AnalyticsCeiling</c>, D-51)
    /// and the quote create route (<c>RateLimits:QuoteCeiling</c>, 60 an hour). Each site-wide limit runs after
    /// the per-address limit, so a call refused per address never uses a ceiling permit (D-74). A ceiling refusal answers that the site is busy.
    /// The slot limiter behind the app-wide cap of two staff uploads at a time is added too (<see cref="UploadSlotsMiddleware"/>), with the
    /// separate pool of anonymous quote photo uploads (<c>UploadSlots:Public</c>, D-39).
    /// The address is read from <c>Connection.RemoteIpAddress</c> only, until the hosting record proves the proxy topology
    /// (D-39, Phase 3); behind a shared proxy every visitor would share one bucket.
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
        var maintenance = MaintenanceRateLimit.Default();
        configuration.GetSection(MaintenanceRateLimit.SectionName).Bind(maintenance);
        var images = ImageUploadRateLimit.Default();
        configuration.GetSection(ImageUploadRateLimit.SectionName).Bind(images);
        var publicRead = PublicReadRateLimit.Default();
        configuration.GetSection(PublicReadRateLimit.SectionName).Bind(publicRead);
        var collect = AnalyticsCollectRateLimit.Default();
        configuration.GetSection(AnalyticsCollectRateLimit.SectionName).Bind(collect);
        var ceiling = AnalyticsCeilingRateLimit.Default();
        configuration.GetSection(AnalyticsCeilingRateLimit.SectionName).Bind(ceiling);
        var quoteCreate = QuoteCreateRateLimit.Default();
        configuration.GetSection(QuoteCreateRateLimit.SectionName).Bind(quoteCreate);
        var quoteCeiling = QuoteCeilingRateLimit.Default();
        configuration.GetSection(QuoteCeilingRateLimit.SectionName).Bind(quoteCeiling);
        var quoteAlertTest = QuoteAlertTestRateLimit.Default();
        configuration.GetSection(QuoteAlertTestRateLimit.SectionName).Bind(quoteAlertTest);
        var publicSlots = PublicUploadSlotRule.Default();
        configuration.GetSection(PublicUploadSlotRule.SectionName).Bind(publicSlots);
        var problems = settings.Validate()
            .Concat(PublicUploadSlotRule.Problems(publicSlots))
            .Concat(RateLimitRule.Problems(ceiling, AnalyticsCeilingRateLimit.SectionName))
            .Concat(RateLimitRule.Problems(quoteCreate, QuoteCreateRateLimit.SectionName))
            .Concat(RateLimitRule.Problems(quoteCeiling, QuoteCeilingRateLimit.SectionName))
            .Concat(RateLimitRule.Problems(quoteAlertTest, QuoteAlertTestRateLimit.SectionName))
            .Concat(RateLimitRule.Problems(collect, AnalyticsCollectRateLimit.SectionName))
            .Concat(RateLimitRule.Problems(maintenance, MaintenanceRateLimit.SectionName))
            .Concat(RateLimitRule.Problems(images, ImageUploadRateLimit.SectionName))
            .Concat(RateLimitRule.Problems(publicRead, PublicReadRateLimit.SectionName))
            .ToList();
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
            [RateLimitPolicies.Maintenance] = maintenance.Window,
            [RateLimitPolicies.ImageUpload] = images.Window,
            [RateLimitPolicies.PublicRead] = publicRead.Window,
            [RateLimitPolicies.AnalyticsCollect] = collect.Window,
            [RateLimitPolicies.QuoteCreate] = quoteCreate.Window,
            [RateLimitPolicies.QuoteAlertTest] = quoteAlertTest.Window,
        };

        services.AddSingleton(_ => UploadSlotsMiddleware.CreateLimiter());
        services.AddSingleton(_ => PublicUploadSlots.Create(publicSlots));
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = (context, cancellationToken) => WriteRejectionAsync(context, windows, cancellationToken);
            options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
                CreateRouteAddressLimiter(collect, quoteCreate),
                CreateSiteWideLimiter(ceiling, quoteCeiling));
            AddPolicy(options, RateLimitPolicies.SignIn, settings.SignIn);
            AddPolicy(options, RateLimitPolicies.Verify, settings.Verify);
            AddPolicy(options, RateLimitPolicies.Resend, settings.Resend);
            AddPolicy(options, RateLimitPolicies.Forgot, settings.Forgot);
            AddPolicy(options, RateLimitPolicies.Reset, settings.Reset);
            AddPolicy(options, RateLimitPolicies.Refresh, settings.Refresh);
            AddPolicy(options, RateLimitPolicies.Maintenance, maintenance);
            AddPolicy(options, RateLimitPolicies.ImageUpload, images);
            AddPolicy(options, RateLimitPolicies.PublicRead, publicRead);
            AddPolicy(options, RateLimitPolicies.AnalyticsCollect, collect);
            AddPolicy(options, RateLimitPolicies.QuoteCreate, quoteCreate);
            AddPolicy(options, RateLimitPolicies.QuoteAlertTest, quoteAlertTest);
        });
        return services;
    }

    /// <summary>
    /// Builds the bucket key for a client address: the full IPv4 address, the first 64 bits of an IPv6 address (one
    /// device's /64, so devices that share a /48 keep separate limits; the per-account lockout stops address rotation),
    /// or a shared key when there is no address. The set of keys is bounded by the address space.
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

    // The per-address limits of the page view and quote create routes, repeated inside the global chain so they are taken before the
    // site-wide ceilings: a call refused here never reaches a ceiling. Each route keeps its own window per address (the key names the
    // route). Every other route gets no global limit. The policy on each action repeats its window as a fallback; a ceiling refusal
    // still uses one address permit.
    private static PartitionedRateLimiter<HttpContext> CreateRouteAddressLimiter(RateLimitRule pageView, RateLimitRule quoteCreate) =>
        PartitionedRateLimiter.Create<HttpContext, string>(context => EndpointName(context) switch
        {
            PageViewEndpointName => RateLimitPartition.GetSlidingWindowLimiter(
                $"{PageViewEndpointName}:{PartitionKey(context.Connection.RemoteIpAddress)}", _ => WindowOptions(pageView)),
            QuoteCreateEndpointName => RateLimitPartition.GetSlidingWindowLimiter(
                $"{QuoteCreateEndpointName}:{PartitionKey(context.Connection.RemoteIpAddress)}", _ => WindowOptions(quoteCreate)),
            _ => RateLimitPartition.GetNoLimiter(NoSiteWideLimitKey),
        });

    // One shared window for each of the two routes, whatever the address; every other route has no site-wide limit.
    private static SiteWideCeilingLimiter CreateSiteWideLimiter(RateLimitRule pageView, RateLimitRule quoteCreate) =>
        new(PartitionedRateLimiter.Create<HttpContext, string>(context => EndpointName(context) switch
        {
            PageViewEndpointName => RateLimitPartition.GetSlidingWindowLimiter(PageViewSitePartitionKey, _ => WindowOptions(pageView)),
            QuoteCreateEndpointName => RateLimitPartition.GetSlidingWindowLimiter(QuoteSitePartitionKey, _ => WindowOptions(quoteCreate)),
            _ => RateLimitPartition.GetNoLimiter(NoSiteWideLimitKey),
        }));

    private static string? EndpointName(HttpContext context) =>
        context.GetEndpoint()?.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName;

    private static SlidingWindowRateLimiterOptions WindowOptions(RateLimitRule rule) =>
        new()
        {
            PermitLimit = rule.PermitLimit,
            Window = rule.Window,
            SegmentsPerWindow = SegmentsPerWindow,
            QueueLimit = 0,
            AutoReplenishment = true,
        };

    private static void AddPolicy(RateLimiterOptions options, string name, RateLimitRule rule) =>
        options.AddPolicy(name, context => RateLimitPartition.GetSlidingWindowLimiter(
            PartitionKey(context.Connection.RemoteIpAddress),
            _ => WindowOptions(rule)));

    private static async ValueTask WriteRejectionAsync(
        OnRejectedContext context, Dictionary<string, TimeSpan> windows, CancellationToken cancellationToken)
    {
        var http = context.HttpContext;
        var policy = http.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;

        // A window reports its own wait; if a lease reports none, the policy's whole window is the safe answer: after it, every
        // earlier request has left the window. Whole seconds, rounded up and never below 1 (SEC-03 precision edge).
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var wait)
            || (policy is not null && windows.TryGetValue(policy, out wait)))
        {
            var seconds = Math.Max(1, (int)Math.Ceiling(wait.TotalSeconds));
            http.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
        }

        var detail = policy switch
        {
            RateLimitPolicies.ImageUpload => UploadsBusyDetail,
            _ when SiteWideCeilingLimiter.Refused(http) => SiteBusyDetail,
            _ => AttemptsDetail,
        };
        var problem = CspsProblemDetails.Build(http, StatusCodes.Status429TooManyRequests, detail, code: RateLimitedCode);
        await TypedResults.Problem(problem).ExecuteAsync(http).ConfigureAwait(false);
    }
}

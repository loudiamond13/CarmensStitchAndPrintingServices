using Csps.Testing;
using Microsoft.AspNetCore.Hosting;

namespace Csps.Server.IntegrationTests.RateLimiting;

/// <summary>
/// A test host that runs with the real D-39 per-address limits. The default factory sets every limit to 100000 so
/// suites never throttle themselves; here the settings are removed again so the built-in defaults apply.
/// </summary>
internal sealed class RealLimitsFactory : CspsApiFactory
{
    /// <summary>The policy names, as they appear in <c>RateLimits:Auth:&lt;name&gt;</c>.</summary>
    public static readonly string[] PolicyNames = ["SignIn", "Verify", "Resend", "Forgot", "Reset", "Refresh"];

    private readonly Dictionary<string, string> _overrides;

    /// <summary>Creates a host with no database.</summary>
    /// <param name="overrides">Extra settings applied after the defaults are restored.</param>
    public RealLimitsFactory(Dictionary<string, string>? overrides = null)
    {
        _overrides = overrides ?? [];
    }

    /// <summary>Creates a host against a real database.</summary>
    /// <param name="connectionString">The connection string the API uses.</param>
    /// <param name="overrides">Extra settings applied after the defaults are restored.</param>
    public RealLimitsFactory(string connectionString, Dictionary<string, string>? overrides = null)
        : base(connectionString)
    {
        _overrides = overrides ?? [];
    }

    /// <summary>Gets the setting key of a policy's permit limit.</summary>
    /// <param name="policy">One of <see cref="PolicyNames"/>.</param>
    /// <returns>The configuration key.</returns>
    public static string PermitLimitKey(string policy) => $"RateLimits:Auth:{policy}:PermitLimit";

    /// <inheritdoc />
    protected override void ConfigureSettings(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        foreach (var policy in PolicyNames)
        {
            builder.UseSetting(PermitLimitKey(policy), null);
        }

        foreach (var (key, value) in _overrides)
        {
            builder.UseSetting(key, value);
        }
    }
}

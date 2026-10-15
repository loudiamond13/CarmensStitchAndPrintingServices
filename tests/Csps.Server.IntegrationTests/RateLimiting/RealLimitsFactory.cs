using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.RateLimiting;

/// <summary>
/// A test host that runs with the real D-39 per-address limits. The default factory sets every limit to 100000 so
/// suites never throttle themselves; here the owner's numbers are set again (the windows keep their defaults).
/// </summary>
internal sealed class RealLimitsFactory : CspsApiFactory
{
    /// <summary>The policy names, as they appear in <c>RateLimits:Auth:&lt;name&gt;</c>.</summary>
    public static readonly string[] PolicyNames = ["SignIn", "Verify", "Resend", "Forgot", "Reset", "Refresh"];

    private static readonly int[] PermitLimits = [10, 10, 5, 5, 10, 60];

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

    /// <summary>Gets a value indicating whether the remote address is read from <see cref="RemoteIpStartupFilter.HeaderName"/>.</summary>
    public bool RemoteIpFromHeader { get; init; }

    /// <summary>Gets the setting key of a policy's permit limit.</summary>
    /// <param name="policy">One of <see cref="PolicyNames"/>.</param>
    /// <returns>The configuration key.</returns>
    public static string PermitLimitKey(string policy) => $"RateLimits:Auth:{policy}:PermitLimit";

    /// <inheritdoc />
    protected override void ConfigureSettings(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        for (var index = 0; index < PolicyNames.Length; index++)
        {
            builder.UseSetting(PermitLimitKey(PolicyNames[index]), PermitLimits[index].ToString(System.Globalization.CultureInfo.InvariantCulture));
        }

        if (RemoteIpFromHeader)
        {
            builder.ConfigureTestServices(services => services.AddSingleton<IStartupFilter, RemoteIpStartupFilter>());
        }

        foreach (var (key, value) in _overrides)
        {
            builder.UseSetting(key, value);
        }
    }
}

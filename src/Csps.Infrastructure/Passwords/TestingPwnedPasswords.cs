#if CSPS_TESTING
using Csps.Application.Ports;
using Csps.Domain.Identity;

namespace Csps.Infrastructure.Passwords;

/// <summary>
/// An offline stand-in for the breach service, compiled into Debug builds only and used in the Testing environment
/// (QUAL-05), so no test reaches the internet. <see cref="BreachedSample"/> is "breached", <see cref="DownSample"/>
/// simulates a service outage, and every other password is "not breached".
/// </summary>
internal sealed class TestingPwnedPasswords : IPwnedPasswords
{
    /// <summary>The documented password the stand-in reports as breached.</summary>
    internal const string BreachedSample = "Pwned#Pass2026";

    /// <summary>The documented password that makes the stand-in report the service as down.</summary>
    internal const string DownSample = "Hibp-Down#2026";

    /// <inheritdoc />
    public Task<BreachCheckResult> CheckAsync(string password, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(password);

        var normalized = PasswordPolicy.Normalize(password);
        var result = normalized switch
        {
            BreachedSample => BreachCheckResult.Breached,
            DownSample => BreachCheckResult.Unavailable,
            _ => BreachCheckResult.NotBreached,
        };
        return Task.FromResult(result);
    }
}
#endif

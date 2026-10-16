namespace Csps.Server.Security;

/// <summary>The names of the per-address auth rate-limit policies (SEC-03, D-39), used with <c>[EnableRateLimiting]</c>.</summary>
public static class RateLimitPolicies
{
    /// <summary>Email and password sign-in.</summary>
    public const string SignIn = "auth-sign-in";

    /// <summary>Checking the emailed sign-in code.</summary>
    public const string Verify = "auth-verify";

    /// <summary>Asking for a new sign-in code.</summary>
    public const string Resend = "auth-resend";

    /// <summary>Asking for a password reset email.</summary>
    public const string Forgot = "auth-forgot";

    /// <summary>Reset and invite links: check, reset, set-new and accept.</summary>
    public const string Reset = "auth-reset";

    /// <summary>Session upkeep: refresh, sign-out and the signed-in devices list.</summary>
    public const string Refresh = "auth-refresh";
}

/// <summary>One sliding-window rule: how many requests one address may make in a window.</summary>
public sealed class RateLimitRule
{
    /// <summary>The shortest window the limiter can split into its six segments.</summary>
    public static readonly TimeSpan MinWindow = TimeSpan.FromSeconds(6);

    /// <summary>Gets or sets how many requests are allowed in the window.</summary>
    public int PermitLimit { get; set; }

    /// <summary>Gets or sets the window length.</summary>
    public TimeSpan Window { get; set; }
}

/// <summary>
/// The per-address limits on the auth endpoints (SEC-03, D-39), read from <c>RateLimits:Auth</c>. The defaults are the
/// owner's numbers; every one can be changed in configuration.
/// </summary>
public sealed class RateLimitSettings
{
    /// <summary>The configuration section these settings bind from.</summary>
    public const string SectionName = "RateLimits:Auth";

    /// <summary>Gets or sets the sign-in rule: 10 per minute.</summary>
    public RateLimitRule SignIn { get; set; } = Rule(10, TimeSpan.FromMinutes(1));

    /// <summary>Gets or sets the code check rule: 10 per minute.</summary>
    public RateLimitRule Verify { get; set; } = Rule(10, TimeSpan.FromMinutes(1));

    /// <summary>Gets or sets the resend rule: 5 per minute.</summary>
    public RateLimitRule Resend { get; set; } = Rule(5, TimeSpan.FromMinutes(1));

    /// <summary>Gets or sets the forgot-password rule: 5 per 15 minutes.</summary>
    public RateLimitRule Forgot { get; set; } = Rule(5, TimeSpan.FromMinutes(15));

    /// <summary>Gets or sets the reset and invite rule: 10 per 15 minutes.</summary>
    public RateLimitRule Reset { get; set; } = Rule(10, TimeSpan.FromMinutes(15));

    /// <summary>Gets or sets the session upkeep rule: 60 per minute.</summary>
    public RateLimitRule Refresh { get; set; } = Rule(60, TimeSpan.FromMinutes(1));

    /// <summary>Lists what is wrong with the settings, naming each setting and never a value.</summary>
    /// <returns>One message per problem; empty when the settings are usable.</returns>
    public IReadOnlyList<string> Validate()
    {
        var problems = new List<string>();
        Check(problems, nameof(SignIn), SignIn);
        Check(problems, nameof(Verify), Verify);
        Check(problems, nameof(Resend), Resend);
        Check(problems, nameof(Forgot), Forgot);
        Check(problems, nameof(Reset), Reset);
        Check(problems, nameof(Refresh), Refresh);
        return problems;
    }

    private static RateLimitRule Rule(int permitLimit, TimeSpan window) => new() { PermitLimit = permitLimit, Window = window };

    private static void Check(List<string> problems, string name, RateLimitRule? rule)
    {
        if (rule is null || rule.PermitLimit < 1)
        {
            problems.Add($"{SectionName}:{name}:PermitLimit must be at least 1.");
        }

        if (rule is null || rule.Window < RateLimitRule.MinWindow)
        {
            problems.Add($"{SectionName}:{name}:Window must be at least 6 seconds.");
        }
    }
}

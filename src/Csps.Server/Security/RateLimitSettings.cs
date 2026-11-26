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

    /// <summary>The scheduled maintenance run (JOB-01, T-09-76): throttles guessing of the maintenance key.</summary>
    public const string Maintenance = "maintenance-run";

    /// <summary>Uploading an order photo (IMG-02, T-09-27): a per-address window on top of the app-wide two-at-a-time cap.</summary>
    public const string ImageUpload = "images-upload";

    /// <summary>Anonymous reads of <c>/api/v1/public/*</c> (SEC-03, P-10): a generous per-address window. The shell, robots.txt and sitemap.xml have no limit.</summary>
    public const string PublicRead = "public-read";

    /// <summary>The anonymous quote create (INQ-03, D-26): a per-address window so one address cannot flood the inbox.</summary>
    public const string QuoteCreate = "quote-create";

    /// <summary>The anonymous page view beacon (ANL-06, T-12-28): a per-address window so the counts cannot be inflated by one address.</summary>
    public const string AnalyticsCollect = "analytics-collect";

    /// <summary>The Manager's Quote alerts test email (D-11, T-13-40): a per-address window so the button cannot flood the inbox.</summary>
    public const string QuoteAlertTest = "quote-alerts-test";
}

/// <summary>The per-address limit on the Quote alerts test email, read from <c>RateLimits:QuoteAlertTest</c>: 3 in 10 minutes by default (D-11).</summary>
public static class QuoteAlertTestRateLimit
{
    /// <summary>The configuration section the rule binds from.</summary>
    public const string SectionName = "RateLimits:QuoteAlertTest";

    /// <summary>Creates the rule with its default numbers.</summary>
    /// <returns>A new rule.</returns>
    public static RateLimitRule Default() => new() { PermitLimit = 3, Window = TimeSpan.FromMinutes(10) };
}

/// <summary>The per-address limit on page view beacons, read from <c>RateLimits:AnalyticsCollect</c>: 120 a minute by default.</summary>
public static class AnalyticsCollectRateLimit
{
    /// <summary>The configuration section the rule binds from.</summary>
    public const string SectionName = "RateLimits:AnalyticsCollect";

    /// <summary>Creates the rule with its default numbers.</summary>
    /// <returns>A new rule.</returns>
    public static RateLimitRule Default() => new() { PermitLimit = 120, Window = TimeSpan.FromMinutes(1) };
}

/// <summary>The one site-wide limit on the page view route (D-51, D-74), read from <c>RateLimits:AnalyticsCeiling</c>: 600 a minute by default.</summary>
public static class AnalyticsCeilingRateLimit
{
    /// <summary>The configuration section the rule binds from.</summary>
    public const string SectionName = "RateLimits:AnalyticsCeiling";

    /// <summary>Creates the rule with its default numbers.</summary>
    /// <returns>A new rule.</returns>
    public static RateLimitRule Default() => new() { PermitLimit = 600, Window = TimeSpan.FromMinutes(1) };
}

/// <summary>The per-address limit on sending the quote form, read from <c>RateLimits:QuoteCreate</c>: 5 an hour by default (D-26).</summary>
public static class QuoteCreateRateLimit
{
    /// <summary>The configuration section the rule binds from.</summary>
    public const string SectionName = "RateLimits:QuoteCreate";

    /// <summary>Creates the rule with its default numbers.</summary>
    /// <returns>A new rule.</returns>
    public static RateLimitRule Default() => new() { PermitLimit = 5, Window = TimeSpan.FromHours(1) };
}

/// <summary>The one site-wide limit on sending the quote form, read from <c>RateLimits:QuoteCeiling</c>: 60 an hour by default.</summary>
public static class QuoteCeilingRateLimit
{
    /// <summary>The configuration section the rule binds from.</summary>
    public const string SectionName = "RateLimits:QuoteCeiling";

    /// <summary>Creates the rule with its default numbers.</summary>
    /// <returns>A new rule.</returns>
    public static RateLimitRule Default() => new() { PermitLimit = 60, Window = TimeSpan.FromHours(1) };
}

/// <summary>The per-address limit on the public reads, read from <c>RateLimits:PublicRead</c>: 600 reads per minute by default.</summary>
public static class PublicReadRateLimit
{
    /// <summary>The configuration section the rule binds from.</summary>
    public const string SectionName = "RateLimits:PublicRead";

    /// <summary>Creates the rule with its default numbers.</summary>
    /// <returns>A new rule.</returns>
    public static RateLimitRule Default() => new() { PermitLimit = 600, Window = TimeSpan.FromMinutes(1) };
}

/// <summary>The per-address limit on photo uploads, read from <c>RateLimits:Images</c>: 30 uploads per 10 minutes by default.</summary>
public static class ImageUploadRateLimit
{
    /// <summary>The configuration section the rule binds from.</summary>
    public const string SectionName = "RateLimits:Images";

    /// <summary>Creates the rule with its default numbers.</summary>
    /// <returns>A new rule.</returns>
    public static RateLimitRule Default() => new() { PermitLimit = 30, Window = TimeSpan.FromMinutes(10) };
}

/// <summary>The per-address limit on the maintenance run, read from <c>RateLimits:Maintenance</c>: 12 requests per 10 minutes by default.</summary>
public static class MaintenanceRateLimit
{
    /// <summary>The configuration section the rule binds from.</summary>
    public const string SectionName = "RateLimits:Maintenance";

    /// <summary>Creates the rule with its default numbers.</summary>
    /// <returns>A new rule.</returns>
    public static RateLimitRule Default() => new() { PermitLimit = 12, Window = TimeSpan.FromMinutes(10) };
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

    /// <summary>Lists what is wrong with a rule, naming each setting and never a value.</summary>
    /// <param name="rule">The rule to check; a missing rule has both problems.</param>
    /// <param name="section">The configuration section the rule binds from.</param>
    /// <returns>One message per problem; empty when the rule is usable.</returns>
    public static IReadOnlyList<string> Problems(RateLimitRule? rule, string section)
    {
        var problems = new List<string>();
        if (rule is null || rule.PermitLimit < 1)
        {
            problems.Add($"{section}:PermitLimit must be at least 1.");
        }

        if (rule is null || rule.Window < MinWindow)
        {
            problems.Add($"{section}:Window must be at least 6 seconds.");
        }

        return problems;
    }
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

    private static void Check(List<string> problems, string name, RateLimitRule? rule) =>
        problems.AddRange(RateLimitRule.Problems(rule, $"{SectionName}:{name}"));
}

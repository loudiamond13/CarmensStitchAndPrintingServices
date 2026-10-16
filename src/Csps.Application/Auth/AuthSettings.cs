using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>
/// The tunable sign-in limits, bound from the <c>Auth</c> section (D-39, AUTH-05). The defaults are the approved
/// values, so no setting is needed to run. The code MAC key lives in the same section but is read elsewhere.
/// </summary>
public sealed class AuthSettings
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "Auth";

    /// <summary>The least time a sign-in answer takes, success or failure (D-39).</summary>
    public TimeSpan ResponseFloor { get; init; } = TimeSpan.FromMilliseconds(500);

    /// <summary>How long an emailed code works.</summary>
    public TimeSpan CodeLifetime { get; init; } = TimeSpan.FromMinutes(15);

    /// <summary>The wrong guesses one code allows.</summary>
    public int CodeAttempts { get; init; } = 5;

    /// <summary>The wait before another code can be sent.</summary>
    public TimeSpan ResendCooldown { get; init; } = TimeSpan.FromSeconds(60);

    /// <summary>The codes one account can be sent per hour.</summary>
    public int SendsPerHour { get; init; } = 5;

    /// <summary>The wrong code guesses across all tickets that lock an account (cross-ticket cap, D-39).</summary>
    public int AccountFailureCap { get; init; } = 10;

    /// <summary>How long an account is paused after the cross-ticket wrong-code cap (D-39).</summary>
    public TimeSpan CodeLockoutDuration { get; init; } = TimeSpan.FromMinutes(15);

    /// <summary>How long an account is paused after the wrong-password cap (five in a row).</summary>
    public TimeSpan PasswordLockoutDuration { get; init; } = TimeSpan.FromMinutes(15);

    /// <summary>How long a pending-login ticket lives.</summary>
    public TimeSpan ChallengeLifetime { get; init; } = TimeSpan.FromMinutes(30);

    /// <summary>How long an access token works (AUTH-05).</summary>
    public TimeSpan AccessTokenLifetime { get; init; } = TimeSpan.FromMinutes(15);

    /// <summary>The life of a "keep me signed in" session.</summary>
    public TimeSpan PersistentSessionLifetime { get; init; } = TimeSpan.FromDays(90);

    /// <summary>The life of a browser session.</summary>
    public TimeSpan BrowserSessionLifetime { get; init; } = TimeSpan.FromHours(12);

    /// <summary>How long a used refresh token still gets a sibling (D-39).</summary>
    public TimeSpan RefreshGrace { get; init; } = TimeSpan.FromSeconds(30);

    /// <summary>The sibling tokens one parent may have in the grace window.</summary>
    public int GraceSiblingCap { get; init; } = 5;

    /// <summary>How long a password reset link works.</summary>
    public TimeSpan ResetLinkLifetime { get; init; } = TimeSpan.FromMinutes(30);

    /// <summary>The reset emails one account can be sent per hour (D-39).</summary>
    public int ResetEmailsPerHour { get; init; } = 3;

    /// <summary>How long an invitation link works.</summary>
    public TimeSpan InviteLinkLifetime { get; init; } = TimeSpan.FromHours(72);

    /// <summary>Returns the code and ticket rules for the Domain.</summary>
    /// <returns>The two-factor settings.</returns>
    public TwoFactorSettings ToTwoFactorSettings() => new()
    {
        CodeLifetime = CodeLifetime,
        MaxAttemptsPerCode = CodeAttempts,
        ResendCooldown = ResendCooldown,
        MaxSendsPerWindow = SendsPerHour,
        AccountFailureCap = AccountFailureCap,
        ChallengeLifetime = ChallengeLifetime,
    };

    /// <summary>Returns the session rules for the Domain.</summary>
    /// <returns>The session settings.</returns>
    public SessionSettings ToSessionSettings() => new()
    {
        PersistentLifetime = PersistentSessionLifetime,
        BrowserSessionLifetime = BrowserSessionLifetime,
        RefreshGrace = RefreshGrace,
        MaxGraceSiblings = GraceSiblingCap,
    };

    /// <summary>Lists the settings that are not usable. Each entry names the setting, never a value.</summary>
    /// <returns>The problems; empty when the settings are valid.</returns>
    public IReadOnlyList<string> Validate()
    {
        var problems = new List<string>();
        RequirePositive(ResponseFloor, nameof(ResponseFloor), problems);
        RequirePositive(CodeLifetime, nameof(CodeLifetime), problems);
        RequirePositive(ResendCooldown, nameof(ResendCooldown), problems);
        RequirePositive(CodeLockoutDuration, nameof(CodeLockoutDuration), problems);
        RequirePositive(PasswordLockoutDuration, nameof(PasswordLockoutDuration), problems);
        RequirePositive(ChallengeLifetime, nameof(ChallengeLifetime), problems);
        RequirePositive(AccessTokenLifetime, nameof(AccessTokenLifetime), problems);
        RequirePositive(PersistentSessionLifetime, nameof(PersistentSessionLifetime), problems);
        RequirePositive(BrowserSessionLifetime, nameof(BrowserSessionLifetime), problems);
        RequirePositive(RefreshGrace, nameof(RefreshGrace), problems);
        RequirePositive(ResetLinkLifetime, nameof(ResetLinkLifetime), problems);
        RequirePositive(InviteLinkLifetime, nameof(InviteLinkLifetime), problems);
        RequirePositive(CodeAttempts, nameof(CodeAttempts), problems);
        RequirePositive(SendsPerHour, nameof(SendsPerHour), problems);
        RequirePositive(AccountFailureCap, nameof(AccountFailureCap), problems);
        RequirePositive(GraceSiblingCap, nameof(GraceSiblingCap), problems);
        RequirePositive(ResetEmailsPerHour, nameof(ResetEmailsPerHour), problems);
        return problems;
    }

    private static void RequirePositive(TimeSpan value, string name, List<string> problems)
    {
        if (value <= TimeSpan.Zero)
        {
            problems.Add($"{SectionName}:{name} must be greater than zero.");
        }
    }

    private static void RequirePositive(int value, string name, List<string> problems)
    {
        if (value <= 0)
        {
            problems.Add($"{SectionName}:{name} must be greater than zero.");
        }
    }
}

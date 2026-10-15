namespace Csps.Domain.Identity;

/// <summary>Limits for the emailed code (D-10, D-39). The defaults are the owner's numbers.</summary>
public sealed record TwoFactorSettings
{
    /// <summary>The owner's defaults.</summary>
    public static TwoFactorSettings Default { get; } = new();

    /// <summary>How long one code works.</summary>
    public TimeSpan CodeLifetime { get; init; } = TimeSpan.FromMinutes(15);

    /// <summary>Wrong tries allowed per code; the last one uses the code up.</summary>
    public int MaxAttemptsPerCode { get; init; } = 5;

    /// <summary>Wait between two codes for one challenge.</summary>
    public TimeSpan ResendCooldown { get; init; } = TimeSpan.FromSeconds(60);

    /// <summary>Codes allowed for one account inside <see cref="SendWindow"/>.</summary>
    public int MaxSendsPerWindow { get; init; } = 5;

    /// <summary>Rolling window for <see cref="MaxSendsPerWindow"/>.</summary>
    public TimeSpan SendWindow { get; init; } = TimeSpan.FromHours(1);

    /// <summary>Wrong codes allowed for one account inside <see cref="AccountFailureWindow"/>.</summary>
    public int AccountFailureCap { get; init; } = 10;

    /// <summary>Rolling window for <see cref="AccountFailureCap"/>.</summary>
    public TimeSpan AccountFailureWindow { get; init; } = TimeSpan.FromHours(1);

    /// <summary>How long a pending sign-in lives.</summary>
    public TimeSpan ChallengeLifetime { get; init; } = TimeSpan.FromMinutes(30);
}

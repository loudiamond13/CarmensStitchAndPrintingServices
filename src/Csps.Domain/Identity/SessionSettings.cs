namespace Csps.Domain.Identity;

/// <summary>Lifetimes and limits for sessions and refresh tokens (D-03, D-39). The defaults are the owner's numbers.</summary>
public sealed record SessionSettings
{
    /// <summary>The owner's defaults.</summary>
    public static SessionSettings Default { get; } = new();

    /// <summary>How long a "Keep me signed in" session lasts from sign-in.</summary>
    public TimeSpan PersistentLifetime { get; init; } = TimeSpan.FromDays(90);

    /// <summary>How long a browser session lasts from sign-in.</summary>
    public TimeSpan BrowserSessionLifetime { get; init; } = TimeSpan.FromHours(12);

    /// <summary>How long after its use a refresh token still gets a sibling instead of a reuse alarm.</summary>
    public TimeSpan RefreshGrace { get; init; } = TimeSpan.FromSeconds(30);

    /// <summary>Grace siblings allowed for one parent token; one more is treated as reuse.</summary>
    public int MaxGraceSiblings { get; init; } = 5;
}

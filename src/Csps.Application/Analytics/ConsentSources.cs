using Csps.Domain.Analytics;

namespace Csps.Application.Analytics;

/// <summary>The source names a browser may send with a decision, and the <see cref="ConsentSource"/> each one means.</summary>
public static class ConsentSources
{
    /// <summary>The cookie bar.</summary>
    public const string Bar = "bar";

    /// <summary>The cookie settings window.</summary>
    public const string Settings = "settings";

    /// <summary>The "Always show maps?" link.</summary>
    public const string MapLink = "map-link";

    /// <summary>Reads a source name the validator has accepted.</summary>
    /// <param name="name">One of <see cref="Bar"/>, <see cref="Settings"/> or <see cref="MapLink"/>.</param>
    /// <returns>The source.</returns>
    /// <exception cref="ArgumentOutOfRangeException">The name is not one the browser may send.</exception>
    public static ConsentSource From(string? name) => name switch
    {
        Bar => ConsentSource.Bar,
        Settings => ConsentSource.Settings,
        MapLink => ConsentSource.MapLink,
        _ => throw new ArgumentOutOfRangeException(nameof(name), "Unknown consent source name."),
    };
}

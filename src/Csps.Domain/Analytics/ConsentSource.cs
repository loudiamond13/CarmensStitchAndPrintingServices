namespace Csps.Domain.Analytics;

/// <summary>Where a consent decision was made (ANL-07). The number is what the database stores.</summary>
public enum ConsentSource : byte
{
    /// <summary>The cookie bar on the first visit.</summary>
    Bar = 1,

    /// <summary>The cookie settings window.</summary>
    Settings = 2,

    /// <summary>The "Always show maps?" link next to a map (D-18).</summary>
    MapLink = 3,

    /// <summary>"Clear my cookies and data" (D-31). Set by the server only; a browser cannot send it.</summary>
    Clear = 4,
}

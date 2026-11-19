namespace Csps.Domain.Analytics;

/// <summary>The device class stored for a visit.</summary>
public enum DeviceKind : byte
{
    /// <summary>A phone.</summary>
    Phone = 1,

    /// <summary>A tablet.</summary>
    Tablet = 2,

    /// <summary>A desktop or laptop computer.</summary>
    Computer = 3,

    /// <summary>Anything else, or no User-Agent.</summary>
    Other = 4,
}

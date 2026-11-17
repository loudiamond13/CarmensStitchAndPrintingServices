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

/// <summary>Reduces a User-Agent to a device class.</summary>
public static class DeviceClass
{
    /// <summary>Returns the device class for <paramref name="userAgent"/>.</summary>
    /// <param name="userAgent">The raw User-Agent header, or null.</param>
    /// <returns>One of the <see cref="DeviceKind"/> values.</returns>
    public static DeviceKind From(string? userAgent) => 0;
}

namespace Csps.Domain.Analytics;

/// <summary>Which label a <see cref="DailyDeviceCount"/> row counts.</summary>
public enum DeviceDimension : byte
{
    /// <summary>The device class: Phone, Tablet, Computer or Other.</summary>
    Device = 1,

    /// <summary>The browser family label.</summary>
    Browser = 2,
}

/// <summary>
/// The anonymous count of visits for one device class or browser on one closed business day (ANL-09, D-03). The retention job writes it
/// from the raw visits before they age out. It holds no visitor id or address.
/// </summary>
public sealed class DailyDeviceCount
{
    private DailyDeviceCount()
    {
        Name = string.Empty;
    }

    /// <summary>Gets the business day (Asia/Manila) the visits started on.</summary>
    public DateOnly BusinessDay { get; private set; }

    /// <summary>Gets whether <see cref="Name"/> is a device class or a browser.</summary>
    public DeviceDimension Dimension { get; private set; }

    /// <summary>Gets the device class name or the browser family label.</summary>
    public string Name { get; private set; }

    /// <summary>Gets how many visits had that label on the day.</summary>
    public int Visits { get; private set; }

    /// <summary>Makes the row for one label on one day.</summary>
    /// <param name="day">The business day.</param>
    /// <param name="dimension">Device or browser.</param>
    /// <param name="name">The label.</param>
    /// <param name="visits">How many visits; at least one.</param>
    /// <returns>The new, unsaved row.</returns>
    /// <exception cref="ArgumentException">The label is blank or longer than <see cref="AnalyticsVisit.LabelMaxLength"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The dimension is not a named one, or the count is below one.</exception>
    public static DailyDeviceCount Of(DateOnly day, DeviceDimension dimension, string name, int visits)
    {
        if (!Enum.IsDefined(dimension))
        {
            throw new ArgumentOutOfRangeException(nameof(dimension), dimension, "Unknown dimension.");
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if (name.Length > AnalyticsVisit.LabelMaxLength)
        {
            throw new ArgumentException("The label is longer than the column holds.", nameof(name));
        }

        ArgumentOutOfRangeException.ThrowIfLessThan(visits, 1);
        return new DailyDeviceCount { BusinessDay = day, Dimension = dimension, Name = name, Visits = visits };
    }
}

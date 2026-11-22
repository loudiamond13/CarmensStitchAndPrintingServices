namespace Csps.Domain.Analytics;

/// <summary>
/// The anonymous count of visits for one device class or browser on one closed business day (ANL-09, D-03). Nothing writes it any more (D-80); the
/// retention job only removes old rows. It holds no visitor id or address.
/// </summary>
public sealed class DailyDeviceCount
{
    private DailyDeviceCount()
    {
        Name = string.Empty;
    }

    /// <summary>Gets the business day (Asia/Manila) the visits started on.</summary>
    public DateOnly BusinessDay { get; private set; }

    /// <summary>Gets whether <see cref="Name"/> is a device class (1) or a browser (2).</summary>
    public byte Dimension { get; private set; }

    /// <summary>Gets the device class name or the browser family label.</summary>
    public string Name { get; private set; }

    /// <summary>Gets how many visits had that label on the day.</summary>
    public int Visits { get; private set; }
}

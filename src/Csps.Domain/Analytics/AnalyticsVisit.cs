namespace Csps.Domain.Analytics;

/// <summary>
/// One visit of a visitor who allowed stats (ANL-05, D-33): the pages seen in one run, ended by 30 minutes of silence (D-07). It holds only
/// reduced values: a hash of the visitor id, a source name, a device class, a browser and OS family label, and an optional salted hash of
/// the address prefix. Never the raw id, address, referrer or User-Agent. The counters change through single updates in the store, so
/// there is no row version.
/// </summary>
public sealed class AnalyticsVisit
{
    /// <summary>The length of a stored hash in bytes (SHA-256 and HMAC-SHA256).</summary>
    public const int HashLength = 32;

    /// <summary>The longest browser or OS family label.</summary>
    public const int LabelMaxLength = 20;

    private AnalyticsVisit()
    {
        VisitorHash = [];
        Referrer = string.Empty;
        Browser = string.Empty;
        Os = string.Empty;
    }

    /// <summary>Gets the visit id.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the SHA-256 of the visitor id cookie value.</summary>
    public byte[] VisitorHash { get; private set; }

    /// <summary>Gets the business day (Asia/Manila) the visit started on; a visit belongs to its start day.</summary>
    public DateOnly BusinessDay { get; private set; }

    /// <summary>Gets when the visit started.</summary>
    public DateTimeOffset StartedAtUtc { get; private set; }

    /// <summary>Gets when the visit last had a page view.</summary>
    public DateTimeOffset LastSeenAtUtc { get; private set; }

    /// <summary>Gets the source name: a fixed name such as Facebook, a validated host, or Direct.</summary>
    public string Referrer { get; private set; }

    /// <summary>Gets the device class.</summary>
    public DeviceKind Device { get; private set; }

    /// <summary>Gets the browser family label.</summary>
    public string Browser { get; private set; }

    /// <summary>Gets the operating system family label.</summary>
    public string Os { get; private set; }

    /// <summary>Gets the HMAC of the address prefix with the day's salt, or null when the connection had no address.</summary>
    public byte[]? IpHash { get; private set; }

    /// <summary>Gets how many page views the visit has.</summary>
    public int PageViews { get; private set; }

    /// <summary>Starts a visit with its first page view.</summary>
    /// <param name="visitorHash">The SHA-256 of the visitor id.</param>
    /// <param name="businessDay">The business day of the start.</param>
    /// <param name="startedAtUtc">The server time of the first page view.</param>
    /// <param name="referrer">The source name, from <see cref="ReferrerName"/>.</param>
    /// <param name="device">The device class.</param>
    /// <param name="browser">The browser family label.</param>
    /// <param name="os">The OS family label.</param>
    /// <param name="ipHash">The salted address hash, or null.</param>
    /// <returns>The new, unsaved visit with one page view.</returns>
    /// <exception cref="ArgumentException">A hash is not 32 bytes, or a text value is blank or longer than its column.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The device is not a named one.</exception>
    public static AnalyticsVisit Start(
        byte[] visitorHash,
        DateOnly businessDay,
        DateTimeOffset startedAtUtc,
        string referrer,
        DeviceKind device,
        string browser,
        string os,
        byte[]? ipHash)
    {
        ArgumentNullException.ThrowIfNull(visitorHash);
        if (visitorHash.Length != HashLength)
        {
            throw new ArgumentException("The visitor hash must be 32 bytes.", nameof(visitorHash));
        }

        if (ipHash is not null && ipHash.Length != HashLength)
        {
            throw new ArgumentException("The address hash must be 32 bytes.", nameof(ipHash));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(referrer);
        if (referrer.Length > ReferrerName.MaxLength)
        {
            throw new ArgumentException("The referrer is longer than the column holds.", nameof(referrer));
        }

        CheckLabel(browser, nameof(browser));
        CheckLabel(os, nameof(os));
        if (!Enum.IsDefined(device))
        {
            throw new ArgumentOutOfRangeException(nameof(device), device, "Unknown device class.");
        }

        return new AnalyticsVisit
        {
            Id = Guid.CreateVersion7(startedAtUtc),
            VisitorHash = visitorHash,
            BusinessDay = businessDay,
            StartedAtUtc = startedAtUtc,
            LastSeenAtUtc = startedAtUtc,
            Referrer = referrer,
            Device = device,
            Browser = browser,
            Os = os,
            IpHash = ipHash,
            PageViews = 1,
        };
    }

    private static void CheckLabel(string label, string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(label, name);
        if (label.Length > LabelMaxLength)
        {
            throw new ArgumentException("The label is longer than the column holds.", name);
        }
    }
}

namespace Csps.Domain.Analytics;

/// <summary>
/// One visit of a visitor who allowed stats (ANL-05, D-33). Nothing writes this table any more (D-56, D-80); the entity stays so the
/// retention job can age out old rows. It holds only reduced values: a hash of the visitor id, a source name, a device class number, a
/// browser and OS family label, and an optional salted hash of the address prefix. There is no row version.
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

    /// <summary>Gets the stored device class number (1 phone, 2 tablet, 3 computer, 4 other).</summary>
    public byte Device { get; private set; }

    /// <summary>Gets the browser family label.</summary>
    public string Browser { get; private set; }

    /// <summary>Gets the operating system family label.</summary>
    public string Os { get; private set; }

    /// <summary>Gets the HMAC of the address prefix with the day's salt, or null when the connection had no address.</summary>
    public byte[]? IpHash { get; private set; }

    /// <summary>Gets how many page views the visit has.</summary>
    public int PageViews { get; private set; }
}

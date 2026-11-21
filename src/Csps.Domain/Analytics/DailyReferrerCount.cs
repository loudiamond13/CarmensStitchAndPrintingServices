namespace Csps.Domain.Analytics;

/// <summary>
/// The anonymous count of visits from one source on one closed business day (ANL-09, D-03). Nothing writes it any more (D-80); the retention job
/// only removes old rows. It holds no visitor id, address or browser name.
/// </summary>
public sealed class DailyReferrerCount
{
    private DailyReferrerCount()
    {
        Referrer = string.Empty;
    }

    /// <summary>Gets the business day (Asia/Manila) the visits started on.</summary>
    public DateOnly BusinessDay { get; private set; }

    /// <summary>Gets the source name: a fixed name such as Facebook, a validated host, or Direct.</summary>
    public string Referrer { get; private set; }

    /// <summary>Gets how many visits the source had on the day.</summary>
    public int Visits { get; private set; }
}

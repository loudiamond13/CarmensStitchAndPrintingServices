namespace Csps.Domain.Analytics;

/// <summary>
/// The anonymous count of visits from one source on one closed business day (ANL-09, D-03). The retention job writes it from the raw visits
/// before they age out, so the stats page never meets a gap. It holds no visitor id, address or browser name.
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

    /// <summary>Makes the row for one source on one day.</summary>
    /// <param name="day">The business day.</param>
    /// <param name="referrer">The source name.</param>
    /// <param name="visits">How many visits; at least one.</param>
    /// <returns>The new, unsaved row.</returns>
    /// <exception cref="ArgumentException">The source is blank or longer than <see cref="ReferrerName.MaxLength"/>.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The count is below one.</exception>
    public static DailyReferrerCount Of(DateOnly day, string referrer, int visits)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(referrer);
        if (referrer.Length > ReferrerName.MaxLength)
        {
            throw new ArgumentException("The referrer is longer than the column holds.", nameof(referrer));
        }

        ArgumentOutOfRangeException.ThrowIfLessThan(visits, 1);
        return new DailyReferrerCount { BusinessDay = day, Referrer = referrer, Visits = visits };
    }
}

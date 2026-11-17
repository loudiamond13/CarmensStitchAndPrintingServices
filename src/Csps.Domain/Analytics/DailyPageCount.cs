namespace Csps.Domain.Analytics;

/// <summary>
/// The anonymous page-view counter for one business day and one page (ANL-06). It holds no visitor id, address or browser name. It is
/// created once with a count of one; after that the count only goes up through a single atomic update in the store, so there is no row version.
/// </summary>
public sealed class DailyPageCount
{
    private DailyPageCount()
    {
        PageKey = string.Empty;
    }

    /// <summary>Gets the business day (Asia/Manila) the views were made on.</summary>
    public DateOnly BusinessDay { get; private set; }

    /// <summary>Gets the page key, one of <see cref="PageKeys"/>.</summary>
    public string PageKey { get; private set; }

    /// <summary>Gets how many page views the page had on the day.</summary>
    public int Views { get; private set; }

    /// <summary>Makes the row for the first view of a page on a day.</summary>
    /// <param name="day">The business day.</param>
    /// <param name="pageKey">The page key.</param>
    /// <returns>The new, unsaved row with one view.</returns>
    /// <exception cref="ArgumentException">The page key is blank or longer than <see cref="PageKeys.MaxLength"/>.</exception>
    public static DailyPageCount First(DateOnly day, string pageKey)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(pageKey);
        if (pageKey.Length > PageKeys.MaxLength)
        {
            throw new ArgumentException("The page key is longer than the column holds.", nameof(pageKey));
        }

        return new DailyPageCount { BusinessDay = day, PageKey = pageKey, Views = 1 };
    }
}

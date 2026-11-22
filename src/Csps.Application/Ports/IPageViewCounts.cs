namespace Csps.Application.Ports;

/// <summary>The anonymous page-view counter: one number per business day and page key (ANL-06). It stores no visitor information.</summary>
public interface IPageViewCounts
{
    /// <summary>Adds one view to the day's count for the page. Many callers may add at once; no view is lost.</summary>
    /// <param name="day">The business day.</param>
    /// <param name="pageKey">The page key.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the view is counted.</returns>
    Task IncrementAsync(DateOnly day, string pageKey, CancellationToken cancellationToken);
}

using Csps.Domain.Analytics;

namespace Csps.Application.Ports;

/// <summary>The store of visits, their page views and their speed samples (ANL-05). Every value it holds is already reduced.</summary>
public interface IAnalyticsVisits
{
    /// <summary>Finds the visitor's newest visit that was last seen after <paramref name="since"/>.</summary>
    /// <param name="visitorHash">The SHA-256 of the visitor id.</param>
    /// <param name="since">The oldest last-seen time that still counts as the current visit.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The visit id, or null when there is no current visit.</returns>
    Task<Guid?> FindCurrentAsync(byte[] visitorHash, DateTimeOffset since, CancellationToken cancellationToken);

    /// <summary>Saves a new visit.</summary>
    /// <param name="visit">The visit, made by <see cref="AnalyticsVisit.Start"/>.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The visit id.</returns>
    Task<Guid> StartAsync(AnalyticsVisit visit, CancellationToken cancellationToken);

    /// <summary>
    /// Starts a visit unless the visitor already has a current one, in one step, so two first page views at the same moment make one visit.
    /// </summary>
    /// <param name="visit">The new visit, made by <see cref="AnalyticsVisit.Start"/>.</param>
    /// <param name="since">The oldest last-seen time that still counts as the current visit.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The visit id, and whether <paramref name="visit"/> was saved (false when the visitor's current visit was found).</returns>
    Task<(Guid VisitId, bool Started)> StartUnlessCurrentAsync(AnalyticsVisit visit, DateTimeOffset since, CancellationToken cancellationToken);

    /// <summary>Adds one page view to a visit's count and moves its last-seen time forward. Many callers may touch one visit at once.</summary>
    /// <param name="visitId">The visit.</param>
    /// <param name="at">The server time of the page view.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the visit is updated.</returns>
    Task TouchAsync(Guid visitId, DateTimeOffset at, CancellationToken cancellationToken);

    /// <summary>Saves one page view row.</summary>
    /// <param name="view">The page view.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the row is saved.</returns>
    Task AddPageViewAsync(AnalyticsPageView view, CancellationToken cancellationToken);

    /// <summary>Saves speed samples.</summary>
    /// <param name="samples">The samples.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the rows are saved.</returns>
    Task AddSamplesAsync(IReadOnlyList<AnalyticsVitalSample> samples, CancellationToken cancellationToken);

    /// <summary>
    /// Deletes every visit of one visitor. The page views and speed samples of those visits go with them. Nothing else is touched, and a visitor
    /// with no rows is not an error (ANL-04, D-41).
    /// </summary>
    /// <param name="visitorHash">The SHA-256 of the visitor id.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the rows are deleted.</returns>
    Task DeleteForVisitorAsync(byte[] visitorHash, CancellationToken cancellationToken);
}

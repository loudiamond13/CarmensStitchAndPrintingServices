using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Analytics;

/// <summary>Compile-only stub for the RED commit.</summary>
/// <param name="context">The database context.</param>
internal sealed class AnalyticsVisits(CspsDbContext context) : IAnalyticsVisits
{
    public Task<Guid?> FindCurrentAsync(byte[] visitorHash, DateTimeOffset since, CancellationToken cancellationToken) =>
        Task.FromResult<Guid?>(context is null ? null : null);

    public Task<Guid> StartAsync(AnalyticsVisit visit, CancellationToken cancellationToken) => Task.FromResult(visit.Id);

    public Task TouchAsync(Guid visitId, DateTimeOffset at, CancellationToken cancellationToken) => Task.CompletedTask;

    public Task AddPageViewAsync(AnalyticsPageView view, CancellationToken cancellationToken) => Task.CompletedTask;

    public Task AddSamplesAsync(IReadOnlyList<AnalyticsVitalSample> samples, CancellationToken cancellationToken) => Task.CompletedTask;
}

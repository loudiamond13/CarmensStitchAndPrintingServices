using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Analytics;

/// <summary><see cref="IVisitorStatsReader"/> over EF: untracked LINQ aggregates (ANL-08).</summary>
/// <param name="context">The scoped database context.</param>
internal sealed class VisitorStatsReader(CspsDbContext context) : IVisitorStatsReader
{
    public Task<VisitorTotals> ReadTotalsAsync(DateOnly first, DateOnly last, DateOnly cut, CancellationToken cancellationToken)
    {
        _ = (context, first, last, cut, cancellationToken);
        throw new NotImplementedException();
    }
}

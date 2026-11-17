using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Analytics;

/// <summary>Compile-only stub for the RED commit.</summary>
/// <param name="context">The database context.</param>
/// <param name="cache">The process cache.</param>
internal sealed class AnalyticsSalts(CspsDbContext context, AnalyticsSaltCache cache) : IAnalyticsSalts
{
    public Task<byte[]> ForDayAsync(DateOnly day, CancellationToken cancellationToken) =>
        Task.FromResult(new byte[context is null || cache is null ? 0 : AnalyticsSalt.Length]);
}

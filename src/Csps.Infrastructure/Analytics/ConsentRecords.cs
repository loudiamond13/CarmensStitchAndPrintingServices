using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Analytics;

/// <summary><see cref="IConsentRecords"/> over EF: a decision is tracked and saved by the unit of work. Records are never read back or edited here.</summary>
/// <param name="context">The database context.</param>
internal sealed class ConsentRecords(CspsDbContext context) : IConsentRecords
{
    public void Add(ConsentRecord record)
    {
        ArgumentNullException.ThrowIfNull(record);
        context.ConsentRecords.Add(record);
    }
}

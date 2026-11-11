using Csps.Application.Ports;
using Csps.Domain.Money;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Money;

/// <summary><see cref="IMoneyTransfers"/> over EF: tracked rows, saved by the unit of work. The entity has no query filter, so a deleted transfer is found too.</summary>
internal sealed class MoneyTransferStore(CspsDbContext context) : IMoneyTransfers
{
    public void Add(MoneyTransfer transfer)
    {
        ArgumentNullException.ThrowIfNull(transfer);
        context.Set<MoneyTransfer>().Add(transfer);
    }

    public async Task<MoneyTransfer?> FindAsync(Guid id, bool includeDeleted, CancellationToken cancellationToken) =>
        await context.Set<MoneyTransfer>()
            .Where(transfer => includeDeleted || transfer.DeletedAtUtc == null)
            .SingleOrDefaultAsync(transfer => transfer.Id == id, cancellationToken)
            .ConfigureAwait(false);

    public void Remove(MoneyTransfer transfer)
    {
        ArgumentNullException.ThrowIfNull(transfer);
        context.Set<MoneyTransfer>().Remove(transfer);
    }
}

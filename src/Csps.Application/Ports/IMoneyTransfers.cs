using Csps.Domain.Money;

namespace Csps.Application.Ports;

/// <summary>The tracked store of staff money transfers: new rows are added and found for change, and saved by <see cref="IUnitOfWork"/>.</summary>
public interface IMoneyTransfers
{
    /// <summary>Adds a new transfer to the unit of work. Nothing is saved here.</summary>
    /// <param name="transfer">The new transfer.</param>
    void Add(MoneyTransfer transfer);

    /// <summary>Finds one transfer for change, tracked, whether or not it is deleted.</summary>
    /// <param name="id">The transfer id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The transfer, or null when none matches.</returns>
    Task<MoneyTransfer?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Marks a transfer for removal from the database in the unit of work (D-24). Nothing is deleted until the unit of work saves.</summary>
    /// <param name="transfer">The tracked transfer to remove.</param>
    void Remove(MoneyTransfer transfer);
}

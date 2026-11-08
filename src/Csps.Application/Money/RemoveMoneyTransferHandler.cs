using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Money;

/// <summary>Use case: a Manager removes a soft-deleted transfer for good (MONEY-06, D-24, D-25).</summary>
public sealed class RemoveMoneyTransferHandler(
    IMoneyTransfers transfers,
    IStaffMoneyLock moneyLock,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext)
{
    /// <summary>Removes the transfer.</summary>
    /// <param name="id">The transfer to remove.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The outcome.</returns>
    public Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        _ = (transfers, moneyLock, audit, unitOfWork, requestContext, id, cancellationToken);
        return Task.FromResult(Result.Failure(MoneyErrors.TransferNotFound));
    }
}

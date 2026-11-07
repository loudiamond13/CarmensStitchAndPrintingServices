using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Domain.Money;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Money;

/// <summary>
/// <see cref="IStaffMoneyReader"/> over EF: one untracked statement over the asked people with six correlated sums (MONEY-01). Payments,
/// refunds and order expenses carry the named SoftDelete filter of their order, and company expenses their own, so money of a deleted
/// order or a deleted expense never counts. Deleted transfers are left out by <see cref="CountedTransfers"/>. Nothing is stored or cached.
/// </summary>
internal sealed class StaffMoneyReader(CspsDbContext context) : IStaffMoneyReader
{
    public async Task<IReadOnlyList<StaffMoneySums>> GetSumsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(userIds);
        var ids = userIds.ToArray();
        var transfers = CountedTransfers(context);

        var rows = await context.Users.AsNoTracking()
            .Where(user => ids.Contains(user.Id))
            .Select(user => new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                Received = context.Set<OrderPayment>().Where(payment => payment.ReceivedByUserId == user.Id).Sum(payment => payment.Amount),
                TransfersIn = transfers.Where(transfer => transfer.ToUserId == user.Id).Sum(transfer => transfer.Amount),
                TransfersOut = transfers.Where(transfer => transfer.FromUserId == user.Id).Sum(transfer => transfer.Amount),
                OrderExpensesPaid = context.Set<OrderExpense>().Where(expense => expense.PaidByUserId == user.Id).Sum(expense => expense.Amount),
                CompanyExpensesPaid = context.CompanyExpenses.Where(expense => expense.PaidByUserId == user.Id).Sum(expense => expense.Amount),
                RefundsHandedBack = context.Set<OrderRefund>().Where(refund => refund.RefundedByUserId == user.Id).Sum(refund => refund.Amount),
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return
        [
            .. rows.Select(row => new StaffMoneySums(
                row.Id,
                $"{row.FirstName} {row.LastName}",
                row.Received,
                row.TransfersIn,
                row.TransfersOut,
                row.OrderExpensesPaid,
                row.CompanyExpensesPaid,
                row.RefundsHandedBack)),
        ];
    }

    // The one place that leaves deleted transfers out; the entity has no query filter (RESEARCH Pitfall 4).
    private static IQueryable<MoneyTransfer> CountedTransfers(CspsDbContext db) =>
        db.Set<MoneyTransfer>().Where(transfer => transfer.DeletedAtUtc == null);
}

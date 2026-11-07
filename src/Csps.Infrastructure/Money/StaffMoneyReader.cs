using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Domain.Money;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Money;

/// <summary>
/// <see cref="IStaffMoneyReader"/> over EF: one untracked statement over the asked people with six correlated sums (MONEY-01). Payments,
/// refunds and order expenses carry the named SoftDelete filter of their order, and company expenses their own, so money of a deleted
/// order or a deleted expense never counts. Deleted transfers are left out by <see cref="CountedTransfers"/>, and the legacy holder is
/// never read (07 D-37). Nothing is stored or cached.
/// </summary>
internal sealed class StaffMoneyReader(CspsDbContext context) : IStaffMoneyReader
{
    public async Task<IReadOnlyList<StaffMoneySums>> GetSumsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(userIds);
        var ids = userIds.ToArray();
        var transfers = CountedTransfers(context);

        var rows = await context.Users.AsNoTracking()
            .Where(user => ids.Contains(user.Id) && user.Id != LegacyHolder.Id)
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

    public async Task<IReadOnlyList<StaffPerson>> ListStaffPeopleAsync(CancellationToken cancellationToken)
    {
        // The role is the account's own Admin or Manager link; an account with neither is not staff and is left out with the holder.
        var rows = await context.Users.AsNoTracking()
            .Where(user => user.Id != LegacyHolder.Id)
            .Select(user => new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                Role = (from userRole in context.UserRoles
                        join role in context.Roles on userRole.RoleId equals role.Id
                        where userRole.UserId == user.Id && (role.Name == Roles.Admin || role.Name == Roles.Manager)
                        orderby role.Name
                        select role.Name).FirstOrDefault(),
                user.IsActive,
                Locked = user.ManagerLockedAtUtc != null,
                Deleted = user.DeletedAtUtc != null,
            })
            .Where(row => row.Role != null)
            .OrderBy(row => row.FirstName)
            .ThenBy(row => row.LastName)
            .ThenBy(row => row.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return [.. rows.Select(row => new StaffPerson(row.Id, $"{row.FirstName} {row.LastName}", row.Role!, row.IsActive, row.Locked, row.Deleted))];
    }

    // The one place that leaves deleted transfers out; the entity has no query filter (RESEARCH Pitfall 4).
    private static IQueryable<MoneyTransfer> CountedTransfers(CspsDbContext db) =>
        db.Set<MoneyTransfer>().Where(transfer => transfer.DeletedAtUtc == null);
}

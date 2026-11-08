using System.Data;
using Csps.Application.Common;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Users;
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
    private const int LedgerReadAttempts = 3;

    public Task<IReadOnlyList<StaffMoneySums>> GetSumsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(userIds);
        return ReadSumsAsync(userIds.ToArray(), cancellationToken);
    }

    private async Task<IReadOnlyList<StaffMoneySums>> ReadSumsAsync(Guid[] ids, CancellationToken cancellationToken)
    {
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
                Deleted = user.DeletedAtUtc != null,
            })
            .Where(row => row.Role != null)
            .OrderBy(row => row.FirstName)
            .ThenBy(row => row.LastName)
            .ThenBy(row => row.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return [.. rows.Select(row => new StaffPerson(row.Id, $"{row.FirstName} {row.LastName}", row.IsActive, row.Deleted) { Role = row.Role ?? string.Empty })];
    }

    public async Task<LedgerPage> GetLedgerPageAsync(Guid userId, int page, int pageSize, bool includeDeleted, CancellationToken cancellationToken)
    {
        // The page, the newer-rows sum, the count and the balance are four reads. One serializable read transaction keeps a row that
        // lands between them from making them disagree (D-105). A transaction the caller already opened could be weaker, so it is refused.
        if (context.Database.CurrentTransaction is not null)
        {
            throw new InvalidOperationException("The ledger read opens its own serializable transaction and cannot run inside another transaction.");
        }

        // A serializable read can lose a deadlock to a writer. The read changes nothing, so it is read again, up to three times.
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken).ConfigureAwait(false);
                await using (transaction.ConfigureAwait(false))
                {
                    var result = await ReadLedgerPageAsync(userId, page, pageSize, includeDeleted, cancellationToken).ConfigureAwait(false);
                    await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                    return result;
                }
            }
            catch (Exception error) when (attempt < LedgerReadAttempts && SqlErrors.Has(error, SqlErrors.DeadlockVictim))
            {
                // The server rolled the transaction back; the next attempt starts clean.
            }
        }
    }

    private async Task<LedgerPage> ReadLedgerPageAsync(Guid userId, int page, int pageSize, bool includeDeleted, CancellationToken cancellationToken)
    {
        var all = StaffLedgerQuery.For(context, userId, includeDeleted);
        var ordered = StaffLedgerQuery.Ordered(all);
        var rows = await StaffLedgerQuery.PageAsync(ordered, page, pageSize, cancellationToken).ConfigureAwait(false);
        var newerSum = await StaffLedgerQuery.SumNewerAsync(ordered, (page - 1) * pageSize, cancellationToken).ConfigureAwait(false);
        var total = await StaffLedgerQuery.CountAsync(all, cancellationToken).ConfigureAwait(false);
        var sums = await ReadSumsAsync([userId], cancellationToken).ConfigureAwait(false);
        var views = await StaffLedgerDetails.ReadAsync(context, rows, cancellationToken).ConfigureAwait(false);
        return new LedgerPage(views, total, newerSum, sums.Count == 0 ? 0m : sums[0].Balance());
    }

    public async Task<MoneyTransferListResponse> ListTransfersAsync(Guid? involving, bool includeDeleted, int page, int pageSize, CancellationToken cancellationToken)
    {
        // The transfer entity has no query filter, so a deleted transfer is left out here unless it is asked for.
        var transfers = context.Set<MoneyTransfer>().AsNoTracking();
        if (!includeDeleted)
        {
            transfers = transfers.Where(transfer => transfer.DeletedAtUtc == null);
        }

        if (involving is { } person)
        {
            transfers = transfers.Where(transfer => transfer.FromUserId == person || transfer.ToUserId == person);
        }

        var total = await transfers.CountAsync(cancellationToken).ConfigureAwait(false);
        var rows = await (
            from transfer in transfers
            join sender in context.Users.AsNoTracking() on transfer.FromUserId equals sender.Id
            join receiver in context.Users.AsNoTracking() on transfer.ToUserId equals receiver.Id
            join recorderUser in context.Users.AsNoTracking() on transfer.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            join deleterUser in context.Users.AsNoTracking() on transfer.DeletedById equals (Guid?)deleterUser.Id into deleters
            from deleter in deleters.DefaultIfEmpty()
            orderby transfer.TransferDate descending, transfer.CreatedAtUtc descending, transfer.Id
            select new
            {
                transfer.Id,
                transfer.FromUserId,
                transfer.ToUserId,
                transfer.Amount,
                transfer.TransferDate,
                transfer.Note,
                transfer.IsHandover,
                transfer.CreatedById,
                transfer.CreatedAtUtc,
                transfer.DeletedById,
                transfer.DeletedAtUtc,
                transfer.RowVersion,
                SenderFirst = sender.FirstName,
                SenderLast = sender.LastName,
                SenderFormer = sender.DeletedAtUtc != null,
                ReceiverFirst = receiver.FirstName,
                ReceiverLast = receiver.LastName,
                ReceiverFormer = receiver.DeletedAtUtc != null,
                RecorderFirst = (string?)recorder.FirstName,
                RecorderLast = (string?)recorder.LastName,
                RecorderFormer = recorder.DeletedAtUtc != null,
                DeleterFirst = (string?)deleter.FirstName,
                DeleterLast = (string?)deleter.LastName,
                DeleterFormer = deleter.DeletedAtUtc != null,
            })
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        IReadOnlyList<MoneyTransferResponse> items =
        [
            .. rows.Select(row => new MoneyTransferResponse(
                row.Id,
                new ActorRef(row.FromUserId, $"{row.SenderFirst} {row.SenderLast}", row.SenderFormer),
                new ActorRef(row.ToUserId, $"{row.ReceiverFirst} {row.ReceiverLast}", row.ReceiverFormer),
                row.Amount,
                row.TransferDate,
                row.Note,
                row.IsHandover,
                row.CreatedById is { } recordedBy && row.RecorderFirst is not null
                    ? new ActorRef(recordedBy, $"{row.RecorderFirst} {row.RecorderLast}", row.RecorderFormer)
                    : null,
                row.CreatedAtUtc,
                row.DeletedAtUtc is not null,
                row.DeletedById is { } deletedBy && row.DeleterFirst is not null
                    ? new ActorRef(deletedBy, $"{row.DeleterFirst} {row.DeleterLast}", row.DeleterFormer)
                    : null,
                row.DeletedAtUtc,
                RowVersions.ToText(row.RowVersion))),
        ];
        return new MoneyTransferListResponse(items, total, page, pageSize);
    }

    // The one place that leaves deleted transfers out; the entity has no query filter (RESEARCH Pitfall 4).
    private static IQueryable<MoneyTransfer> CountedTransfers(CspsDbContext db) =>
        db.Set<MoneyTransfer>().Where(transfer => transfer.DeletedAtUtc == null);
}

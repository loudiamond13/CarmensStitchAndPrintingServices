using Csps.Domain.Money;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Money;

/// <summary>
/// The ledger union for one staff member (MONEY-02): one UNION ALL of narrow, same-typed projections, one per money source. No string
/// column goes into the union, so the sources always line up. The named SoftDelete filters stay on every source, so money on a deleted
/// order or a deleted company expense never reaches a ledger; nothing here lifts a filter, because a lifted filter covers the whole query.
/// </summary>
internal static class StaffLedgerQuery
{
    /// <summary>All of one person's money rows, not yet in any order.</summary>
    /// <param name="context">The database context.</param>
    /// <param name="userId">The person whose money rows are wanted.</param>
    /// <param name="includeDeletedTransfers">True to add the person's deleted transfers, each with a signed amount of 0 and the deleted mark; false to leave them out.</param>
    /// <returns>A query over the union.</returns>
    public static IQueryable<StaffLedgerRow> For(CspsDbContext context, Guid userId, bool includeDeletedTransfers = false)
    {
        ArgumentNullException.ThrowIfNull(context);

        var payments = context.Set<OrderPayment>().AsNoTracking()
            .Where(payment => payment.ReceivedByUserId == userId)
            .Select(payment => new StaffLedgerRow
            {
                Kind = (int)LedgerEntryKind.PaymentReceived,
                SourceId = payment.Id,
                Date = payment.PaymentDate,
                RecordedAtUtc = payment.CreatedAtUtc,
                Signed = payment.Amount,
                Deleted = false,
            });

        var refunds = context.Set<OrderRefund>().AsNoTracking()
            .Where(refund => refund.RefundedByUserId == userId)
            .Select(refund => new StaffLedgerRow
            {
                Kind = (int)LedgerEntryKind.RefundHandedBack,
                SourceId = refund.Id,
                Date = refund.RefundDate,
                RecordedAtUtc = refund.CreatedAtUtc,
                Signed = -refund.Amount,
                Deleted = false,
            });

        var companyExpenses = context.CompanyExpenses.AsNoTracking()
            .Where(expense => expense.PaidByUserId == userId)
            .Select(expense => new StaffLedgerRow
            {
                Kind = (int)LedgerEntryKind.CompanyExpensePaid,
                SourceId = expense.Id,
                Date = expense.ExpenseDate,
                RecordedAtUtc = expense.CreatedAtUtc,
                Signed = -expense.Amount,
                Deleted = false,
            });

        var orderExpenses = context.Set<OrderExpense>().AsNoTracking()
            .Where(expense => expense.PaidByUserId == userId)
            .Select(expense => new StaffLedgerRow
            {
                Kind = (int)LedgerEntryKind.OrderExpensePaid,
                SourceId = expense.Id,
                Date = expense.ExpenseDate,
                RecordedAtUtc = expense.CreatedAtUtc,
                Signed = -expense.Amount,
                Deleted = false,
            });

        // The transfer entity has no query filter (RESEARCH Pitfall 4), so a deleted transfer is left out here, in one place.
        var transfers = context.Set<MoneyTransfer>().AsNoTracking();
        if (!includeDeletedTransfers)
        {
            transfers = transfers.Where(transfer => transfer.DeletedAtUtc == null);
        }

        var transfersIn = transfers
            .Where(transfer => transfer.ToUserId == userId)
            .Select(transfer => new StaffLedgerRow
            {
                Kind = (int)LedgerEntryKind.TransferIn,
                SourceId = transfer.Id,
                Date = transfer.TransferDate,
                RecordedAtUtc = transfer.CreatedAtUtc,
                Signed = transfer.DeletedAtUtc == null ? transfer.Amount : 0m,
                Deleted = transfer.DeletedAtUtc != null,
            });

        var transfersOut = transfers
            .Where(transfer => transfer.FromUserId == userId)
            .Select(transfer => new StaffLedgerRow
            {
                Kind = (int)LedgerEntryKind.TransferOut,
                SourceId = transfer.Id,
                Date = transfer.TransferDate,
                RecordedAtUtc = transfer.CreatedAtUtc,
                Signed = transfer.DeletedAtUtc == null ? -transfer.Amount : 0m,
                Deleted = transfer.DeletedAtUtc != null,
            });

        return payments.Concat(refunds).Concat(transfersIn).Concat(transfersOut).Concat(companyExpenses).Concat(orderExpenses);
    }

    /// <summary>Puts the rows newest first: date, then recorded time, both descending, then kind and source id ascending so every read gives the same order.</summary>
    /// <param name="rows">The rows to order.</param>
    /// <returns>The ordered query.</returns>
    public static IQueryable<StaffLedgerRow> Ordered(IQueryable<StaffLedgerRow> rows)
    {
        ArgumentNullException.ThrowIfNull(rows);
        return rows
            .OrderByDescending(row => row.Date)
            .ThenByDescending(row => row.RecordedAtUtc)
            .ThenBy(row => row.Kind)
            .ThenBy(row => row.SourceId);
    }

    /// <summary>Reads one page of an ordered ledger in one statement.</summary>
    /// <param name="ordered">The query from <see cref="Ordered"/>.</param>
    /// <param name="page">The page number, from 1.</param>
    /// <param name="pageSize">The rows per page.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The rows of the page, newest first.</returns>
    public static async Task<IReadOnlyList<StaffLedgerRow>> PageAsync(IQueryable<StaffLedgerRow> ordered, int page, int pageSize, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ordered);
        return await ordered.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Adds up the signed amounts of the first <paramref name="skip"/> rows of an ordered ledger: the rows newer than a page.</summary>
    /// <param name="ordered">The query from <see cref="Ordered"/>.</param>
    /// <param name="skip">How many of the newest rows to add up; <c>(page - 1) * pageSize</c> for a page.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The sum, 0.00 when there are no such rows.</returns>
    public static async Task<decimal> SumNewerAsync(IQueryable<StaffLedgerRow> ordered, int skip, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ordered);
        if (skip <= 0)
        {
            return 0.00m;
        }

        return await ordered.Take(skip).SumAsync(row => row.Signed, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Counts the rows of a ledger.</summary>
    /// <param name="rows">The query from <see cref="For"/>.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The number of rows.</returns>
    public static async Task<int> CountAsync(IQueryable<StaffLedgerRow> rows, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(rows);
        return await rows.CountAsync(cancellationToken).ConfigureAwait(false);
    }
}

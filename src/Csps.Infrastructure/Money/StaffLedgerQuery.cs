using Csps.Domain.Expenses;
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
    /// <returns>A query over the union.</returns>
    public static IQueryable<StaffLedgerRow> For(CspsDbContext context, Guid userId)
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

        return payments.Concat(companyExpenses);
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
}

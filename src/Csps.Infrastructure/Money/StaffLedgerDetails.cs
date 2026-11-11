using Csps.Application.Common;
using Csps.Application.Money;
using Csps.Application.Users;
using Csps.Domain.Money;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Money;

/// <summary>
/// The text of the rows on one ledger page (MONEY-02): one small untracked read for each kind present on the page, at most five
/// (payments, refunds, order expenses, company expenses, transfers), never one per row. The union carries no strings, so the names
/// are joined here. A deleted person keeps their name and is marked former staff.
/// </summary>
internal static class StaffLedgerDetails
{
    /// <summary>Adds the details to the rows of a page.</summary>
    /// <param name="context">The database context.</param>
    /// <param name="rows">The rows of the page, newest first.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The same rows in the same order, each with its details.</returns>
    public static async Task<IReadOnlyList<LedgerRowView>> ReadAsync(CspsDbContext context, IReadOnlyList<StaffLedgerRow> rows, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(rows);

        // A transfer in and a transfer out are read together, so a page costs one read for each source table at most.
        var views = new Dictionary<(int Kind, Guid Id), LedgerRowView>();
        foreach (var group in rows.GroupBy(row => (LedgerEntryKind)row.Kind == LedgerEntryKind.TransferOut ? (int)LedgerEntryKind.TransferIn : row.Kind))
        {
            var ofKind = group.ToList();
            var found = (LedgerEntryKind)group.Key switch
            {
                LedgerEntryKind.PaymentReceived => await PaymentsAsync(context, ofKind, cancellationToken).ConfigureAwait(false),
                LedgerEntryKind.RefundHandedBack => await RefundsAsync(context, ofKind, cancellationToken).ConfigureAwait(false),
                LedgerEntryKind.TransferIn => await TransfersAsync(context, ofKind, cancellationToken).ConfigureAwait(false),
                LedgerEntryKind.CompanyExpensePaid => await CompanyExpensesAsync(context, ofKind, cancellationToken).ConfigureAwait(false),
                LedgerEntryKind.OrderExpensePaid => await OrderExpensesAsync(context, ofKind, cancellationToken).ConfigureAwait(false),
                _ => [],
            };
            foreach (var view in found)
            {
                views[((int)view.Kind, view.SourceId)] = view;
            }
        }

        return [.. rows.Select(row => views.TryGetValue((row.Kind, row.SourceId), out var view) ? view : Plain(row))];
    }

    private static LedgerRowView Plain(StaffLedgerRow row) =>
        new((LedgerEntryKind)row.Kind, row.SourceId, row.Date, row.RecordedAtUtc, row.Signed, row.Deleted);

    private static async Task<List<LedgerRowView>> PaymentsAsync(CspsDbContext context, List<StaffLedgerRow> rows, CancellationToken cancellationToken)
    {
        var ids = rows.Select(row => row.SourceId).ToArray();
        var found = await (
            from payment in context.Set<OrderPayment>().AsNoTracking()
            where ids.Contains(payment.Id)
            join order in context.Orders.AsNoTracking() on payment.OrderId equals order.Id
            join method in context.PaymentMethods.AsNoTracking() on payment.PaymentMethodId equals method.Id
            select new { payment.Id, OrderId = order.Id, order.Number, order.TeamName, order.CustomerName, MethodName = method.Name })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return
        [
            .. from row in rows
               join detail in found on row.SourceId equals detail.Id
               select Plain(row) with
               {
                   OrderId = detail.OrderId,
                   OrderNumber = detail.Number,
                   Team = detail.TeamName,
                   Customer = detail.CustomerName,
                   PaymentMethod = detail.MethodName,
               },
        ];
    }

    private static async Task<List<LedgerRowView>> RefundsAsync(CspsDbContext context, List<StaffLedgerRow> rows, CancellationToken cancellationToken)
    {
        var ids = rows.Select(row => row.SourceId).ToArray();
        var found = await (
            from refund in context.Set<OrderRefund>().AsNoTracking()
            where ids.Contains(refund.Id)
            join order in context.Orders.AsNoTracking() on refund.OrderId equals order.Id
            select new { refund.Id, OrderId = order.Id, order.Number, order.TeamName, order.CustomerName })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return
        [
            .. from row in rows
               join detail in found on row.SourceId equals detail.Id
               select Plain(row) with { OrderId = detail.OrderId, OrderNumber = detail.Number, Team = detail.TeamName, Customer = detail.CustomerName },
        ];
    }

    private static async Task<List<LedgerRowView>> OrderExpensesAsync(CspsDbContext context, List<StaffLedgerRow> rows, CancellationToken cancellationToken)
    {
        var ids = rows.Select(row => row.SourceId).ToArray();
        var found = await (
            from expense in context.Set<OrderExpense>().AsNoTracking()
            where ids.Contains(expense.Id)
            join order in context.Orders.AsNoTracking() on expense.OrderId equals order.Id
            join category in context.OrderExpenseCategories.AsNoTracking() on expense.OrderExpenseCategoryId equals category.Id
            select new { expense.Id, OrderId = order.Id, order.Number, CategoryName = category.Name, expense.Description })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return
        [
            .. from row in rows
               join detail in found on row.SourceId equals detail.Id
               select Plain(row) with { OrderId = detail.OrderId, OrderNumber = detail.Number, Category = detail.CategoryName, Description = detail.Description },
        ];
    }

    private static async Task<List<LedgerRowView>> CompanyExpensesAsync(CspsDbContext context, List<StaffLedgerRow> rows, CancellationToken cancellationToken)
    {
        var ids = rows.Select(row => row.SourceId).ToArray();
        var found = await (
            from expense in context.CompanyExpenses.AsNoTracking()
            where ids.Contains(expense.Id)
            join category in context.ExpenseCategories.AsNoTracking() on expense.CategoryId equals category.Id
            select new { expense.Id, CategoryName = category.Name, expense.Description })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return
        [
            .. from row in rows
               join detail in found on row.SourceId equals detail.Id
               select Plain(row) with { Category = detail.CategoryName, Description = detail.Description },
        ];
    }

    private static async Task<List<LedgerRowView>> TransfersAsync(CspsDbContext context, List<StaffLedgerRow> rows, CancellationToken cancellationToken)
    {
        var ids = rows.Select(row => row.SourceId).ToArray();
        var found = await (
            from transfer in context.Set<MoneyTransfer>().AsNoTracking()
            where ids.Contains(transfer.Id)
            join sender in context.Users.AsNoTracking() on transfer.FromUserId equals sender.Id
            join receiver in context.Users.AsNoTracking() on transfer.ToUserId equals receiver.Id
            join recorderUser in context.Users.AsNoTracking() on transfer.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            join deleterUser in context.Users.AsNoTracking() on transfer.DeletedById equals (Guid?)deleterUser.Id into deleters
            from deleter in deleters.DefaultIfEmpty()
            select new
            {
                transfer.Id,
                transfer.FromUserId,
                transfer.ToUserId,
                transfer.Amount,
                transfer.Note,
                transfer.IsHandover,
                transfer.RowVersion,
                transfer.CreatedById,
                transfer.DeletedById,
                transfer.DeletedAtUtc,
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
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return
        [
            .. from row in rows
               join detail in found on row.SourceId equals detail.Id
               select Plain(row) with
               {
                   DeletedAmount = detail.DeletedAtUtc is null ? null : detail.Amount,
                   Counterpart = (LedgerEntryKind)row.Kind == LedgerEntryKind.TransferIn
                       ? new ActorRef(detail.FromUserId, $"{detail.SenderFirst} {detail.SenderLast}", detail.SenderFormer)
                       : new ActorRef(detail.ToUserId, $"{detail.ReceiverFirst} {detail.ReceiverLast}", detail.ReceiverFormer),
                   Note = detail.Note,
                   Version = RowVersions.ToText(detail.RowVersion),
                   IsHandover = detail.IsHandover,
                   RecordedBy = detail.CreatedById is { } recordedBy && detail.RecorderFirst is not null
                       ? new ActorRef(recordedBy, $"{detail.RecorderFirst} {detail.RecorderLast}", detail.RecorderFormer)
                       : null,
                   DeletedBy = detail.DeletedById is { } deletedBy && detail.DeleterFirst is not null
                       ? new ActorRef(deletedBy, $"{detail.DeleterFirst} {detail.DeleterLast}", detail.DeleterFormer)
                       : null,
                   DeletedAtUtc = detail.DeletedAtUtc,
               },
        ];
    }
}

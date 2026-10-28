using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Users;
using Csps.Domain.Orders;
using Csps.Infrastructure.Common;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Orders;

/// <summary><see cref="IOrderReader"/> over EF: untracked reads, one statement for the order, one for the items and one for the history.</summary>
internal sealed class OrderReader(CspsDbContext context) : IOrderReader
{
    private const string SoftDeleteFilter = "SoftDelete";

    public async Task<OrderListPage> ListAsync(OrderListQuery query, DateTimeOffset now, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        // The named SoftDelete filter hides a deleted order. Every figure is a stored column.
        var matches = Filter(context.Orders.AsNoTracking(), query, now);

        // Command 1: the count over every page. Command 2: the page, ending on the id so paging is stable.
        var total = await matches.CountAsync(cancellationToken).ConfigureAwait(false);
        var rows = await Sort(matches, query.Sort)
            .Select(order => new OrderListRow(
                order.Id,
                order.Number,
                order.CustomerName,
                order.TeamName,
                order.OrderDate,
                order.DueDate,
                order.Status,
                order.StatusChangedAtUtc,
                order.Subtotal,
                order.DiscountTotal,
                order.Total,
                order.PaidTotal,
                order.RefundedTotal,
                order.Balance,
                order.CustomerCredit,
                order.FullyPaid))
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new OrderListPage(rows, total);
    }

    // The statuses, the search, the order dates, the product type and the balance. A typed wildcard stays literal (CWE-943).
    private IQueryable<Order> Filter(IQueryable<Order> orders, OrderListQuery query, DateTimeOffset now)
    {
        switch (query.Scope)
        {
            case OrderListScope.Active:
                var since = now.AddDays(-OrderRules.RecentEndStateDays);
                orders = orders.Where(order =>
                    (order.Status != OrderStatus.Completed && order.Status != OrderStatus.Cancelled) || order.StatusChangedAtUtc >= since);
                break;
            case OrderListScope.One when query.Status is { } status:
                orders = orders.Where(order => order.Status == status);
                break;
            case OrderListScope.All:
            case OrderListScope.One:
                break;
        }

        if (query.Search is { } search)
        {
            var pattern = LikePattern.Contains(search);
            orders = orders.Where(order =>
                EF.Functions.Like(order.Number, pattern, LikePattern.EscapeCharacter)
                || EF.Functions.Like(order.CustomerName, pattern, LikePattern.EscapeCharacter)
                || EF.Functions.Like(order.TeamName, pattern, LikePattern.EscapeCharacter)
                || EF.Functions.Like(order.ContactNumber, pattern, LikePattern.EscapeCharacter));
        }

        if (query.From is { } from)
        {
            orders = orders.Where(order => order.OrderDate >= from);
        }

        if (query.To is { } to)
        {
            orders = orders.Where(order => order.OrderDate <= to);
        }

        if (query.ProductTypeId is { } productTypeId)
        {
            // The outer query already hides deleted orders, so the item filter is lifted to keep the subquery a plain lookup.
            var items = context.Set<OrderItem>().IgnoreQueryFilters([SoftDeleteFilter]);
            orders = orders.Where(order => items.Any(item => item.OrderId == order.Id && item.ProductTypeId == productTypeId));
        }

        return query.HasBalance ? orders.Where(order => order.Balance > 0m) : orders;
    }

    // Every sort ends on the id. The due sort puts orders with no due date last.
    private static IOrderedQueryable<Order> Sort(IQueryable<Order> orders, OrderListSort sort) => sort switch
    {
        OrderListSort.Newest => orders.OrderByDescending(order => order.OrderDate).ThenByDescending(order => order.CreatedAtUtc).ThenBy(order => order.Id),
        OrderListSort.Balance => orders.OrderByDescending(order => order.Balance).ThenBy(order => order.Id),
        OrderListSort.Total => orders.OrderByDescending(order => order.Total).ThenBy(order => order.Id),
        _ => orders.OrderBy(order => order.DueDate == null).ThenBy(order => order.DueDate).ThenBy(order => order.Id),
    };

    public async Task<DeletedOrderPage> ListDeletedAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        // The named SoftDelete filter is lifted for this read only, and only deleted rows are kept.
        var matches = context.Orders.IgnoreQueryFilters([SoftDeleteFilter]).AsNoTracking().Where(order => order.DeletedAtUtc != null);

        // Command 1: the count over every page. Command 2: the page, most recently deleted first, ending on the id so paging is
        // stable. A deleted person keeps their name (D-08, D-11).
        var total = await matches.CountAsync(cancellationToken).ConfigureAwait(false);
        var rows = await (
            from order in matches
            join deleterUser in context.Users.AsNoTracking() on order.DeletedById equals (Guid?)deleterUser.Id into deleters
            from deleter in deleters.DefaultIfEmpty()
            orderby order.DeletedAtUtc descending, order.Id descending
            select new
            {
                order.Id,
                order.Number,
                order.CustomerName,
                order.TeamName,
                order.Status,
                order.Total,
                Paid = order.PaidTotal,
                order.Balance,
                DeletedAtUtc = order.DeletedAtUtc!.Value,
                order.DeletedById,
                DeleterFirst = (string?)deleter.FirstName,
                DeleterLast = (string?)deleter.LastName,
                DeleterFormer = deleter.DeletedAtUtc != null,
            })
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        IReadOnlyList<DeletedOrderRow> items =
        [
            .. rows.Select(row => new DeletedOrderRow(
                row.Id,
                row.Number,
                row.CustomerName,
                row.TeamName,
                row.Status,
                row.Total,
                row.Paid,
                row.Balance,
                row.DeletedAtUtc,
                row.DeletedById is { } deletedBy && row.DeleterFirst is not null
                    ? new ActorRef(deletedBy, $"{row.DeleterFirst} {row.DeleterLast}", row.DeleterFormer)
                    : null)),
        ];
        return new DeletedOrderPage(items, total);
    }

    public async Task<OrderDetailResponse?> GetDetailAsync(Guid id, CancellationToken cancellationToken)
    {
        // The named SoftDelete filter hides a deleted order. The recorder and the last changer come from their own user rows, so a
        // rename shows at once and a deleted person keeps their name (D-08, D-11).
        var header = await (
            from row in context.Orders.AsNoTracking()
            where row.Id == id
            join recorderUser in context.Users on row.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            join changerUser in context.Users on row.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            select new
            {
                Order = row,
                RecorderFirst = (string?)recorder.FirstName,
                RecorderLast = (string?)recorder.LastName,
                RecorderFormer = recorder.DeletedAtUtc != null,
                ChangerId = (Guid?)changer.Id,
                ChangerFirst = (string?)changer.FirstName,
                ChangerLast = (string?)changer.LastName,
                ChangerFormer = changer.DeletedAtUtc != null,
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
        if (header is null)
        {
            return null;
        }

        var items = await (
            from item in context.Set<OrderItem>().AsNoTracking()
            where item.OrderId == id
            join productType in context.ProductTypes.AsNoTracking() on item.ProductTypeId equals productType.Id
            orderby item.Position
            select new OrderItemResponse(
                item.Id,
                new OrderListRef(productType.Id, productType.Name, productType.Tone, productType.RetiredAtUtc != null),
                item.Description,
                item.SizeVariant,
                item.Quantity,
                item.UnitPrice,
                item.LineTotal))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var discountRows = await (
            from discount in context.Set<OrderDiscount>().AsNoTracking()
            where discount.OrderId == id
            join recorderUser in context.Users on discount.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            join changerUser in context.Users on discount.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            orderby discount.Position
            select new
            {
                Discount = discount,
                RecorderFirst = (string?)recorder.FirstName,
                RecorderLast = (string?)recorder.LastName,
                RecorderFormer = recorder.DeletedAtUtc != null,
                ChangerId = (Guid?)changer.Id,
                ChangerFirst = (string?)changer.FirstName,
                ChangerLast = (string?)changer.LastName,
                ChangerFormer = changer.DeletedAtUtc != null,
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // The receiver rule (ORD-22, D-32, D-49) is the same set as StaffState.CanPay, evaluated in SQL: an active Admin or Manager
        // with a password and a confirmed sign-in who is neither locked nor deleted. Keep in step with StaffDirectory.
        var paymentRows = await (
            from payment in context.Set<OrderPayment>().AsNoTracking()
            where payment.OrderId == id
            join method in context.PaymentMethods.AsNoTracking() on payment.PaymentMethodId equals method.Id
            join receiver in context.Users on payment.ReceivedByUserId equals receiver.Id
            join recorderUser in context.Users on payment.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            join changerUser in context.Users on payment.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            orderby payment.PaymentDate, payment.Position
            select new
            {
                Payment = payment,
                MethodName = method.Name,
                MethodTone = method.Tone,
                MethodRetired = method.RetiredAtUtc != null,
                ReceiverFirst = receiver.FirstName,
                ReceiverLast = receiver.LastName,
                ReceiverFormer = receiver.DeletedAtUtc != null,
                ReceiverActive = receiver.IsActive
                    && receiver.ManagerLockedAtUtc == null
                    && receiver.DeletedAtUtc == null
                    && receiver.PasswordHash != null
                    && receiver.EmailConfirmed
                    && context.UserRoles.Any(link => link.UserId == receiver.Id && context.Roles.Any(role =>
                        role.Id == link.RoleId && (role.Name == Roles.Admin || role.Name == Roles.Manager))),
                RecorderFirst = (string?)recorder.FirstName,
                RecorderLast = (string?)recorder.LastName,
                RecorderFormer = recorder.DeletedAtUtc != null,
                ChangerId = (Guid?)changer.Id,
                ChangerFirst = (string?)changer.FirstName,
                ChangerLast = (string?)changer.LastName,
                ChangerFormer = changer.DeletedAtUtc != null,
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // The refunder rule (D-07, D-32) is the same set as the receiver rule above: StaffState.CanPay, evaluated in SQL.
        var refundRows = await (
            from refund in context.Set<OrderRefund>().AsNoTracking()
            where refund.OrderId == id
            join refunder in context.Users on refund.RefundedByUserId equals refunder.Id
            join recorderUser in context.Users on refund.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            join changerUser in context.Users on refund.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            orderby refund.RefundDate, refund.Position
            select new
            {
                Refund = refund,
                RefunderFirst = refunder.FirstName,
                RefunderLast = refunder.LastName,
                RefunderFormer = refunder.DeletedAtUtc != null,
                RefunderActive = refunder.IsActive
                    && refunder.ManagerLockedAtUtc == null
                    && refunder.DeletedAtUtc == null
                    && refunder.PasswordHash != null
                    && refunder.EmailConfirmed
                    && context.UserRoles.Any(link => link.UserId == refunder.Id && context.Roles.Any(role =>
                        role.Id == link.RoleId && (role.Name == Roles.Admin || role.Name == Roles.Manager))),
                RecorderFirst = (string?)recorder.FirstName,
                RecorderLast = (string?)recorder.LastName,
                RecorderFormer = recorder.DeletedAtUtc != null,
                ChangerId = (Guid?)changer.Id,
                ChangerFirst = (string?)changer.FirstName,
                ChangerLast = (string?)changer.LastName,
                ChangerFormer = changer.DeletedAtUtc != null,
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // The payer rule (ORD-23, D-32) is the same set as the receiver rule above: StaffState.CanPay, evaluated in SQL.
        var expenseRows = await (
            from expense in context.Set<OrderExpense>().AsNoTracking()
            where expense.OrderId == id
            join category in context.OrderExpenseCategories.AsNoTracking() on expense.OrderExpenseCategoryId equals category.Id
            join payer in context.Users on expense.PaidByUserId equals payer.Id
            join recorderUser in context.Users on expense.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            join changerUser in context.Users on expense.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            orderby expense.ExpenseDate, expense.Position
            select new
            {
                Expense = expense,
                CategoryName = category.Name,
                CategoryTone = category.Tone,
                CategoryRetired = category.RetiredAtUtc != null,
                PayerFirst = payer.FirstName,
                PayerLast = payer.LastName,
                PayerFormer = payer.DeletedAtUtc != null,
                PayerActive = payer.IsActive
                    && payer.ManagerLockedAtUtc == null
                    && payer.DeletedAtUtc == null
                    && payer.PasswordHash != null
                    && payer.EmailConfirmed
                    && context.UserRoles.Any(link => link.UserId == payer.Id && context.Roles.Any(role =>
                        role.Id == link.RoleId && (role.Name == Roles.Admin || role.Name == Roles.Manager))),
                RecorderFirst = (string?)recorder.FirstName,
                RecorderLast = (string?)recorder.LastName,
                RecorderFormer = recorder.DeletedAtUtc != null,
                ChangerId = (Guid?)changer.Id,
                ChangerFirst = (string?)changer.FirstName,
                ChangerLast = (string?)changer.LastName,
                ChangerFormer = changer.DeletedAtUtc != null,
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var changes = await (
            from change in context.Set<OrderStatusChange>().AsNoTracking()
            where change.OrderId == id
            join actorUser in context.Users on change.ChangedById equals (Guid?)actorUser.Id into actors
            from actor in actors.DefaultIfEmpty()
            orderby change.ChangedAtUtc, change.Id
            select new
            {
                change.FromStatus,
                change.ToStatus,
                change.ChangedAtUtc,
                ActorId = (Guid?)actor.Id,
                ActorFirst = (string?)actor.FirstName,
                ActorLast = (string?)actor.LastName,
                ActorFormer = actor.DeletedAtUtc != null,
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var order = header.Order;
        return new OrderDetailResponse(
            order.Id,
            order.Number,
            order.CustomerName,
            order.TeamName,
            order.ContactNumber,
            order.Email,
            order.Address,
            order.OrderDate,
            order.DueDate,
            OrderStatusNames.ToKey(order.Status),
            order.StatusChangedAtUtc,
            order.Notes,
            items,
            [
                .. discountRows.Select(row => new OrderDiscountResponse(
                    row.Discount.Id,
                    DiscountKindNames.ToKey(row.Discount.Kind),
                    row.Discount.Value,
                    row.Discount.Reason,
                    row.Discount.CreatedById is { } recordedBy && row.RecorderFirst is not null
                        ? new ActorRef(recordedBy, $"{row.RecorderFirst} {row.RecorderLast}", row.RecorderFormer)
                        : null,
                    row.Discount.CreatedAtUtc,
                    row.ChangerId is { } changedBy && row.ChangerFirst is not null
                        ? new ActorRef(changedBy, $"{row.ChangerFirst} {row.ChangerLast}", row.ChangerFormer)
                        : null,
                    row.Discount.UpdatedAtUtc)),
            ],
            [
                .. paymentRows.Select(row => new OrderPaymentResponse(
                    row.Payment.Id,
                    row.Payment.PaymentDate,
                    row.Payment.Amount,
                    new OrderListRef(row.Payment.PaymentMethodId, row.MethodName, row.MethodTone, row.MethodRetired),
                    row.Payment.Reference,
                    row.Payment.Notes,
                    new ActorRef(row.Payment.ReceivedByUserId, $"{row.ReceiverFirst} {row.ReceiverLast}", row.ReceiverFormer),
                    row.ReceiverActive,
                    row.Payment.CreatedById is { } recordedBy && row.RecorderFirst is not null
                        ? new ActorRef(recordedBy, $"{row.RecorderFirst} {row.RecorderLast}", row.RecorderFormer)
                        : null,
                    row.Payment.CreatedAtUtc,
                    row.ChangerId is { } changedBy && row.ChangerFirst is not null
                        ? new ActorRef(changedBy, $"{row.ChangerFirst} {row.ChangerLast}", row.ChangerFormer)
                        : null,
                    row.Payment.UpdatedAtUtc)),
            ],
            [
                .. refundRows.Select(row => new OrderRefundResponse(
                    row.Refund.Id,
                    row.Refund.RefundDate,
                    row.Refund.Amount,
                    row.Refund.Reason,
                    new ActorRef(row.Refund.RefundedByUserId, $"{row.RefunderFirst} {row.RefunderLast}", row.RefunderFormer),
                    row.RefunderActive,
                    row.Refund.CreatedById is { } recordedBy && row.RecorderFirst is not null
                        ? new ActorRef(recordedBy, $"{row.RecorderFirst} {row.RecorderLast}", row.RecorderFormer)
                        : null,
                    row.Refund.CreatedAtUtc,
                    row.ChangerId is { } changedBy && row.ChangerFirst is not null
                        ? new ActorRef(changedBy, $"{row.ChangerFirst} {row.ChangerLast}", row.ChangerFormer)
                        : null,
                    row.Refund.UpdatedAtUtc)),
            ],
            [
                .. expenseRows.Select(row => new OrderExpenseResponse(
                    row.Expense.Id,
                    row.Expense.ExpenseDate,
                    new OrderListRef(row.Expense.OrderExpenseCategoryId, row.CategoryName, row.CategoryTone, row.CategoryRetired),
                    row.Expense.Description,
                    row.Expense.Amount,
                    new ActorRef(row.Expense.PaidByUserId, $"{row.PayerFirst} {row.PayerLast}", row.PayerFormer),
                    row.PayerActive,
                    row.Expense.CreatedById is { } recordedBy && row.RecorderFirst is not null
                        ? new ActorRef(recordedBy, $"{row.RecorderFirst} {row.RecorderLast}", row.RecorderFormer)
                        : null,
                    row.Expense.CreatedAtUtc,
                    row.ChangerId is { } changedBy && row.ChangerFirst is not null
                        ? new ActorRef(changedBy, $"{row.ChangerFirst} {row.ChangerLast}", row.ChangerFormer)
                        : null,
                    row.Expense.UpdatedAtUtc)),
            ],
            [
                .. changes.Select(change => new OrderStatusChangeResponse(
                    change.FromStatus is { } from ? OrderStatusNames.ToKey(from) : null,
                    OrderStatusNames.ToKey(change.ToStatus),
                    change.ActorId is { } actorId && change.ActorFirst is not null
                        ? new ActorRef(actorId, $"{change.ActorFirst} {change.ActorLast}", change.ActorFormer)
                        : null,
                    change.ChangedAtUtc)),
            ],
            new OrderTotalsResponse(
                order.Subtotal,
                order.DiscountTotal,
                order.Total,
                order.PaidTotal,
                order.RefundedTotal,
                order.Balance,
                order.CustomerCredit,
                order.ExpensesTotal,
                order.Profit,
                order.FullyPaid),
            order.CreatedById is { } creator && header.RecorderFirst is not null
                ? new ActorRef(creator, $"{header.RecorderFirst} {header.RecorderLast}", header.RecorderFormer)
                : null,
            order.CreatedAtUtc,
            header.ChangerId is { } changed && header.ChangerFirst is not null
                ? new ActorRef(changed, $"{header.ChangerFirst} {header.ChangerLast}", header.ChangerFormer)
                : null,
            order.UpdatedAtUtc,
            RowVersions.ToText(order.RowVersion));
    }
}

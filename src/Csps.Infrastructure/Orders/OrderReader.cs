using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Orders;

/// <summary><see cref="IOrderReader"/> over EF: untracked reads, one statement for the order, one for the items and one for the history.</summary>
internal sealed class OrderReader(CspsDbContext context) : IOrderReader
{
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

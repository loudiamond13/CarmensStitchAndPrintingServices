using Csps.Application.Ports;
using Csps.Domain.OrderLists;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.OrderLists;

/// <summary><see cref="IOrderLists"/> over EF: untracked reads of the list tables.</summary>
internal sealed class OrderListStore(CspsDbContext context) : IOrderLists
{
    public async Task<IReadOnlyList<OrderListEntryView>> ListAsync(OrderListKind kind, CancellationToken cancellationToken)
    {
        var othersId = OrderExpenseCategory.OthersId;
        var query = kind switch
        {
            OrderListKind.ProductType => context.ProductTypes.AsNoTracking().Select(entry => new OrderListEntryView(entry.Id, entry.Name, entry.Tone, entry.RetiredAtUtc != null, false)),
            OrderListKind.PaymentMethod => context.PaymentMethods.AsNoTracking().Select(entry => new OrderListEntryView(entry.Id, entry.Name, entry.Tone, entry.RetiredAtUtc != null, false)),
            OrderListKind.OrderExpenseCategory => context.OrderExpenseCategories.AsNoTracking().Select(entry => new OrderListEntryView(entry.Id, entry.Name, entry.Tone, entry.RetiredAtUtc != null, entry.Id == othersId)),
            _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown order list."),
        };
        return await query.ToListAsync(cancellationToken).ConfigureAwait(false);
    }
}

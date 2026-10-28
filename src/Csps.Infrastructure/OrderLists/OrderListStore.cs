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

    public async Task<IReadOnlyList<OrderListEntryState>> GetStatesAsync(OrderListKind kind, IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);
        var query = kind switch
        {
            OrderListKind.ProductType => context.ProductTypes.AsNoTracking().Where(entry => ids.Contains(entry.Id)).Select(entry => new OrderListEntryState(entry.Id, entry.Name, entry.RetiredAtUtc != null)),
            OrderListKind.PaymentMethod => context.PaymentMethods.AsNoTracking().Where(entry => ids.Contains(entry.Id)).Select(entry => new OrderListEntryState(entry.Id, entry.Name, entry.RetiredAtUtc != null)),
            OrderListKind.OrderExpenseCategory => context.OrderExpenseCategories.AsNoTracking().Where(entry => ids.Contains(entry.Id)).Select(entry => new OrderListEntryState(entry.Id, entry.Name, entry.RetiredAtUtc != null)),
            _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown order list."),
        };
        return await query.ToListAsync(cancellationToken).ConfigureAwait(false);
    }
}

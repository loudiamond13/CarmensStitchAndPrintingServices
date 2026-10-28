using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.OrderLists;

/// <summary><see cref="IOrderLists"/> over EF: untracked reads of the list tables, tracked rows saved by the unit of work.</summary>
internal sealed class OrderListStore(CspsDbContext context) : IOrderLists
{
    private static readonly string[] SoftDeleteFilter = ["SoftDelete"];

    public async Task<IReadOnlyList<OrderListEntryView>> ListAsync(OrderListKind kind, CancellationToken cancellationToken)
    {
        var othersId = OrderExpenseCategory.OthersId;
        var query = kind switch
        {
            OrderListKind.ProductType => context.ProductTypes.AsNoTracking().Select(entry => new OrderListEntryView(entry.Id, entry.Name, entry.Tone, entry.RetiredAtUtc != null, false, context.Set<OrderItem>().IgnoreQueryFilters(SoftDeleteFilter).Count(item => item.ProductTypeId == entry.Id))),
            OrderListKind.PaymentMethod => context.PaymentMethods.AsNoTracking().Select(entry => new OrderListEntryView(entry.Id, entry.Name, entry.Tone, entry.RetiredAtUtc != null, false, context.Set<OrderPayment>().IgnoreQueryFilters(SoftDeleteFilter).Count(payment => payment.PaymentMethodId == entry.Id))),
            OrderListKind.OrderExpenseCategory => context.OrderExpenseCategories.AsNoTracking().Select(entry => new OrderListEntryView(entry.Id, entry.Name, entry.Tone, entry.RetiredAtUtc != null, entry.Id == othersId, context.Set<OrderExpense>().IgnoreQueryFilters(SoftDeleteFilter).Count(expense => expense.OrderExpenseCategoryId == entry.Id))),
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

    public async Task<OrderListEntry?> FindAsync(OrderListKind kind, Guid id, CancellationToken cancellationToken) => kind switch
    {
        OrderListKind.ProductType => await context.ProductTypes.SingleOrDefaultAsync(entry => entry.Id == id, cancellationToken).ConfigureAwait(false),
        OrderListKind.PaymentMethod => await context.PaymentMethods.SingleOrDefaultAsync(entry => entry.Id == id, cancellationToken).ConfigureAwait(false),
        OrderListKind.OrderExpenseCategory => await context.OrderExpenseCategories.SingleOrDefaultAsync(entry => entry.Id == id, cancellationToken).ConfigureAwait(false),
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown order list."),
    };

    public async Task<OrderListEntryDetailView?> GetDetailAsync(OrderListKind kind, Guid id, CancellationToken cancellationToken)
    {
        var row = kind switch
        {
            OrderListKind.ProductType => await ReadRowAsync(context.ProductTypes, kind, id, cancellationToken).ConfigureAwait(false),
            OrderListKind.PaymentMethod => await ReadRowAsync(context.PaymentMethods, kind, id, cancellationToken).ConfigureAwait(false),
            OrderListKind.OrderExpenseCategory => await ReadRowAsync(context.OrderExpenseCategories, kind, id, cancellationToken).ConfigureAwait(false),
            _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown order list."),
        };
        if (row is null)
        {
            return null;
        }

        var uses = await CountUsesAsync(kind, id, cancellationToken).ConfigureAwait(false);
        return new OrderListEntryDetailView(
            row.Id,
            row.Name,
            row.Tone,
            row.Retired,
            row.IsOthers,
            uses,
            row.CreatedById is { } creator && row.RecorderFirst is not null ? new ActorRef(creator, $"{row.RecorderFirst} {row.RecorderLast}", row.RecorderFormer) : null,
            row.CreatedAtUtc,
            row.ChangerId is { } changed && row.ChangerFirst is not null ? new ActorRef(changed, $"{row.ChangerFirst} {row.ChangerLast}", row.ChangerFormer) : null,
            row.UpdatedAtUtc,
            row.RowVersion);
    }

    public async Task<int> CountUsesAsync(OrderListKind kind, Guid id, CancellationToken cancellationToken) => kind switch
    {
        OrderListKind.ProductType => await context.Set<OrderItem>().IgnoreQueryFilters(SoftDeleteFilter).CountAsync(item => item.ProductTypeId == id, cancellationToken).ConfigureAwait(false),
        OrderListKind.PaymentMethod => await context.Set<OrderPayment>().IgnoreQueryFilters(SoftDeleteFilter).CountAsync(payment => payment.PaymentMethodId == id, cancellationToken).ConfigureAwait(false),
        OrderListKind.OrderExpenseCategory => await context.Set<OrderExpense>().IgnoreQueryFilters(SoftDeleteFilter).CountAsync(expense => expense.OrderExpenseCategoryId == id, cancellationToken).ConfigureAwait(false),
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown order list."),
    };

    public async Task<bool> NameTakenAsync(OrderListKind kind, string normalizedName, Guid? excluding, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(normalizedName);
        return kind switch
        {
            OrderListKind.ProductType => await context.ProductTypes.AsNoTracking().AnyAsync(entry => entry.NormalizedName == normalizedName && entry.Id != excluding, cancellationToken).ConfigureAwait(false),
            OrderListKind.PaymentMethod => await context.PaymentMethods.AsNoTracking().AnyAsync(entry => entry.NormalizedName == normalizedName && entry.Id != excluding, cancellationToken).ConfigureAwait(false),
            OrderListKind.OrderExpenseCategory => await context.OrderExpenseCategories.AsNoTracking().AnyAsync(entry => entry.NormalizedName == normalizedName && entry.Id != excluding, cancellationToken).ConfigureAwait(false),
            _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown order list."),
        };
    }

    public void Add(OrderListEntry entry)
    {
        ArgumentNullException.ThrowIfNull(entry);
        context.Add((object)entry);
    }

    public void Remove(OrderListEntry entry)
    {
        ArgumentNullException.ThrowIfNull(entry);
        context.Remove((object)entry);
    }

    // The recorder and the last changer come from their own user rows, so a rename shows at once and a deleted person keeps their name.
    private async Task<DetailRow?> ReadRowAsync<TEntry>(IQueryable<TEntry> source, OrderListKind kind, Guid id, CancellationToken cancellationToken)
        where TEntry : OrderListEntry
    {
        var othersId = kind == OrderListKind.OrderExpenseCategory ? OrderExpenseCategory.OthersId : Guid.Empty;
        return await (
            from entry in source.AsNoTracking()
            where entry.Id == id
            join recorderUser in context.Users on entry.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            join changerUser in context.Users on entry.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            select new DetailRow(
                entry.Id,
                entry.Name,
                entry.Tone,
                entry.RetiredAtUtc != null,
                entry.Id == othersId,
                entry.CreatedById,
                entry.CreatedAtUtc,
                entry.UpdatedAtUtc,
                entry.RowVersion,
                (string?)recorder.FirstName,
                (string?)recorder.LastName,
                recorder.DeletedAtUtc != null,
                (Guid?)changer.Id,
                (string?)changer.FirstName,
                (string?)changer.LastName,
                changer.DeletedAtUtc != null))
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    private sealed record DetailRow(
        Guid Id,
        string Name,
        string Tone,
        bool Retired,
        bool IsOthers,
        Guid? CreatedById,
        DateTimeOffset CreatedAtUtc,
        DateTimeOffset? UpdatedAtUtc,
        byte[] RowVersion,
        string? RecorderFirst,
        string? RecorderLast,
        bool RecorderFormer,
        Guid? ChangerId,
        string? ChangerFirst,
        string? ChangerLast,
        bool ChangerFormer);
}

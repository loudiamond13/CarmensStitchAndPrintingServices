using Csps.Domain.Common;

namespace Csps.Domain.OrderLists;

/// <summary>
/// What an order expense was for, for example fabric (D-17). Managers add, rename, recolor and retire categories. Others can change
/// colour but is never renamed, retired or deleted.
/// </summary>
public sealed class OrderExpenseCategory : OrderListEntry
{
    private const string Prefix = "order-expense-categories";
    private const string NounText = "category";

    // Used by EF Core (constructor binding), by Create and by FromSeed.
    private OrderExpenseCategory(Guid id, string name, string normalizedName, string tone, DateTimeOffset createdAtUtc)
        : base(id, name, normalizedName, tone, createdAtUtc)
    {
    }

    /// <summary>The id of Others, which can never be renamed, retired or deleted.</summary>
    public static Guid OthersId => OrderListSeed.OrderExpenseOthersId;

    /// <inheritdoc />
    public override bool IsOthers => Id == OthersId;

    /// <inheritdoc />
    private protected override string ErrorPrefix => Prefix;

    /// <inheritdoc />
    private protected override string Noun => NounText;

    /// <summary>Builds a seeded category with its fixed creation stamp and no attribution (it reads as System).</summary>
    /// <param name="row">The seed row.</param>
    /// <returns>The category.</returns>
    public static OrderExpenseCategory FromSeed(OrderListSeedRow row)
    {
        ArgumentNullException.ThrowIfNull(row);
        return new OrderExpenseCategory(row.Id, row.Name, Normalize(row.Name), row.Tone, OrderListSeed.SeededAtUtc);
    }

    /// <summary>Records a new, active category.</summary>
    /// <param name="name">The name; required after trimming, at most 40 characters.</param>
    /// <param name="tone">One of the six tones.</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved category, or a validation error naming the first broken field.</returns>
    public static Result<OrderExpenseCategory> Create(string name, string tone, DateTimeOffset now) =>
        Build(name, tone, now, Prefix, NounText, static (id, trimmed, normalized, chosen, at) => new OrderExpenseCategory(id, trimmed, normalized, chosen, at));
}

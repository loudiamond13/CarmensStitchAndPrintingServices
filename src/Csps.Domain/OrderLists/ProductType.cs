using Csps.Domain.Common;

namespace Csps.Domain.OrderLists;

/// <summary>What an order item is, for example a basketball jersey (D-18). Managers add, rename, recolor and retire product types.</summary>
public sealed class ProductType : OrderListEntry
{
    private const string Prefix = "product-types";
    private const string NounText = "product type";

    // Used by EF Core (constructor binding), by Create and by FromSeed.
    private ProductType(Guid id, string name, string normalizedName, string tone, DateTimeOffset createdAtUtc)
        : base(id, name, normalizedName, tone, createdAtUtc)
    {
    }

    /// <inheritdoc />
    private protected override string ErrorPrefix => Prefix;

    /// <inheritdoc />
    private protected override string Noun => NounText;

    /// <summary>Builds a seeded product type with its fixed creation stamp and no attribution (it reads as System).</summary>
    /// <param name="row">The seed row.</param>
    /// <returns>The product type.</returns>
    public static ProductType FromSeed(OrderListSeedRow row)
    {
        ArgumentNullException.ThrowIfNull(row);
        return new ProductType(row.Id, row.Name, Normalize(row.Name), row.Tone, OrderListSeed.SeededAtUtc);
    }

    /// <summary>Records a new, active product type.</summary>
    /// <param name="name">The name; required after trimming, at most 40 characters.</param>
    /// <param name="tone">One of the six tones.</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved product type, or a validation error naming the first broken field.</returns>
    public static Result<ProductType> Create(string name, string tone, DateTimeOffset now) =>
        Build(name, tone, now, Prefix, NounText, static (id, trimmed, normalized, chosen, at) => new ProductType(id, trimmed, normalized, chosen, at));
}

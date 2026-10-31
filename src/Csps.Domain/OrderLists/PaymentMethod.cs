using Csps.Domain.Common;

namespace Csps.Domain.OrderLists;

/// <summary>How a payment was made, for example GCash (D-16). Managers add, rename, recolor and retire payment methods.</summary>
public sealed class PaymentMethod : OrderListEntry
{
    private const string Prefix = "payment-methods";
    private const string NounText = "payment method";

    // Used by EF Core (constructor binding), by Create and by FromSeed.
    private PaymentMethod(Guid id, string name, string normalizedName, string tone, DateTimeOffset createdAtUtc)
        : base(id, name, normalizedName, tone, createdAtUtc)
    {
    }

    /// <inheritdoc />
    private protected override string ErrorPrefix => Prefix;

    /// <inheritdoc />
    private protected override string Noun => NounText;

    /// <summary>Builds a seeded payment method with its fixed creation stamp and no attribution (it reads as System).</summary>
    /// <param name="row">The seed row.</param>
    /// <returns>The payment method.</returns>
    public static PaymentMethod FromSeed(OrderListSeedRow row)
    {
        ArgumentNullException.ThrowIfNull(row);
        return new PaymentMethod(row.Id, row.Name, Normalize(row.Name), row.Tone, OrderListSeed.SeededAtUtc);
    }

    /// <summary>Records a new, active payment method.</summary>
    /// <param name="name">The name; required after trimming, at most 40 characters.</param>
    /// <param name="tone">One of the six tones.</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved payment method, or a validation error naming the first broken field.</returns>
    public static Result<PaymentMethod> Create(string name, string tone, DateTimeOffset now) =>
        Build(name, tone, now, Prefix, NounText, static (id, trimmed, normalized, chosen, at) => new PaymentMethod(id, trimmed, normalized, chosen, at));
}

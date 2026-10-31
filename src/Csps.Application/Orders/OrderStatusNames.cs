using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>The wire keys of the seven order statuses (D-01): lower case, one word, no spaces.</summary>
public static class OrderStatusNames
{
    private static readonly (OrderStatus Status, string Key)[] Pairs =
    [
        (OrderStatus.Pending, "pending"),
        (OrderStatus.Mockup, "mockup"),
        (OrderStatus.InProduction, "production"),
        (OrderStatus.Ready, "ready"),
        (OrderStatus.Delivered, "delivered"),
        (OrderStatus.Completed, "completed"),
        (OrderStatus.Cancelled, "cancelled"),
    ];

    /// <summary>Gets the key of a status.</summary>
    /// <param name="status">The status.</param>
    /// <returns>For example <c>production</c> for <see cref="OrderStatus.InProduction"/>.</returns>
    /// <exception cref="ArgumentOutOfRangeException">The number is not one of the seven.</exception>
    public static string ToKey(OrderStatus status)
    {
        foreach (var (known, key) in Pairs)
        {
            if (known == status)
            {
                return key;
            }
        }

        throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown order status.");
    }

    /// <summary>Reads a key, ignoring case and spaces around it.</summary>
    /// <param name="text">The text sent by a client.</param>
    /// <param name="status">The status when the text is one of the seven keys.</param>
    /// <returns>True when the text names a status.</returns>
    public static bool TryParse(string? text, out OrderStatus status)
    {
        foreach (var (known, key) in Pairs)
        {
            if (string.Equals(text?.Trim(), key, StringComparison.OrdinalIgnoreCase))
            {
                status = known;
                return true;
            }
        }

        status = default;
        return false;
    }
}

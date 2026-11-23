using System.Threading.RateLimiting;

namespace Csps.Server.Security;

/// <summary>
/// The upload slots of anonymous visitors (D-39, CWE-770), kept apart from the staff slots so a crowd of visitors can never take the
/// places staff need for order and product photos.
/// </summary>
/// <param name="limiter">The limiter that holds the slots.</param>
public sealed class PublicUploadSlots(ConcurrencyLimiter limiter) : IDisposable
{
    /// <summary>Gets the limiter that holds the slots.</summary>
    public ConcurrencyLimiter Limiter { get; } = limiter ?? throw new ArgumentNullException(nameof(limiter));

    /// <summary>Creates the slots from a checked rule.</summary>
    /// <param name="rule">How many uploads run at once and how many wait.</param>
    /// <returns>The slots.</returns>
    public static PublicUploadSlots Create(PublicUploadSlotRule rule)
    {
        ArgumentNullException.ThrowIfNull(rule);
        return new PublicUploadSlots(new ConcurrencyLimiter(new ConcurrencyLimiterOptions
        {
            PermitLimit = rule.AtOnce,
            QueueLimit = rule.Waiting,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
        }));
    }

    /// <inheritdoc />
    public void Dispose() => Limiter.Dispose();
}

/// <summary>
/// The size of the public upload pool, read from <c>UploadSlots:Public</c>: 2 at once with 4 waiting by default. It is small on
/// purpose: the app pool has 256 MB and a photo is held in memory while it is checked.
/// </summary>
public sealed class PublicUploadSlotRule
{
    /// <summary>The configuration section the rule binds from.</summary>
    public const string SectionName = "UploadSlots:Public";

    /// <summary>The most uploads that may run at once.</summary>
    public const int MaxAtOnce = 8;

    /// <summary>The most uploads that may wait.</summary>
    public const int MaxWaiting = 20;

    /// <summary>Gets or sets how many public uploads run at once.</summary>
    public int AtOnce { get; set; }

    /// <summary>Gets or sets how many public uploads wait for a place before the next one is refused.</summary>
    public int Waiting { get; set; }

    /// <summary>Creates the rule with its default numbers.</summary>
    /// <returns>A new rule.</returns>
    public static PublicUploadSlotRule Default() => new() { AtOnce = 2, Waiting = 4 };

    /// <summary>Lists what is wrong with a rule, naming each setting and never a value.</summary>
    /// <param name="rule">The rule to check; a missing rule has both problems.</param>
    /// <returns>One message per problem; empty when the rule is usable.</returns>
    public static IReadOnlyList<string> Problems(PublicUploadSlotRule? rule)
    {
        var problems = new List<string>();
        if (rule is null || rule.AtOnce is < 1 or > MaxAtOnce)
        {
            problems.Add($"{SectionName}:{nameof(AtOnce)} must be from 1 to {MaxAtOnce}.");
        }

        if (rule is null || rule.Waiting is < 0 or > MaxWaiting)
        {
            problems.Add($"{SectionName}:{nameof(Waiting)} must be from 0 to {MaxWaiting}.");
        }

        return problems;
    }
}

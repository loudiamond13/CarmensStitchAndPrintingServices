namespace Csps.Domain.Analytics;

/// <summary>
/// The random salt of one business day, used to hash the address prefix of visits made that day (ANL-05, D-07). Salts are deleted after
/// two days, so an old hash cannot be recomputed from an address.
/// </summary>
public sealed class AnalyticsSalt
{
    /// <summary>The length of a salt in bytes.</summary>
    public const int Length = 32;

    private AnalyticsSalt()
    {
        Salt = [];
    }

    /// <summary>Gets the business day the salt belongs to.</summary>
    public DateOnly BusinessDay { get; private set; }

    /// <summary>Gets the random bytes.</summary>
    public byte[] Salt { get; private set; }

    /// <summary>Makes the salt row for a day.</summary>
    /// <param name="businessDay">The business day.</param>
    /// <param name="salt">Exactly 32 random bytes.</param>
    /// <returns>The new, unsaved row.</returns>
    /// <exception cref="ArgumentException">The salt is not 32 bytes.</exception>
    public static AnalyticsSalt Create(DateOnly businessDay, byte[] salt)
    {
        ArgumentNullException.ThrowIfNull(salt);
        if (salt.Length != Length)
        {
            throw new ArgumentException("The salt must be 32 bytes.", nameof(salt));
        }

        return new AnalyticsSalt { BusinessDay = businessDay, Salt = salt };
    }
}

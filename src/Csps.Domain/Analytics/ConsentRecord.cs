namespace Csps.Domain.Analytics;

/// <summary>
/// One cookie decision, kept as proof of consent (ANL-07). It holds the full state after the decision. A row is never edited: each decision
/// adds one, and only the cleanup job removes old ones (D-05). It stores no address and no browser name (PRD section 5.4).
/// </summary>
public sealed class ConsentRecord
{
    /// <summary>The longest policy version the table keeps.</summary>
    public const int PolicyVersionMaxLength = 16;

    private ConsentRecord()
    {
        PolicyVersion = string.Empty;
    }

    /// <summary>Gets the record id.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the id of the consent chain: the decisions of one browser share it.</summary>
    public Guid ConsentId { get; private set; }

    /// <summary>Gets the cookie policy version the decision was made under.</summary>
    public string PolicyVersion { get; private set; }

    /// <summary>Gets a value indicating whether visitor stats are allowed; null when the visitor has not chosen (a map-only save, D-18).</summary>
    public bool? Stats { get; private set; }

    /// <summary>Gets a value indicating whether the Google map is allowed.</summary>
    public bool Map { get; private set; }

    /// <summary>Gets a value indicating whether the browser sent the Global Privacy Control signal with the decision (D-20).</summary>
    public bool Gpc { get; private set; }

    /// <summary>Gets where the decision was made.</summary>
    public ConsentSource Source { get; private set; }

    /// <summary>Gets the server time of the decision.</summary>
    public DateTimeOffset DecidedAtUtc { get; private set; }

    /// <summary>Records one decision.</summary>
    /// <param name="consentId">The consent chain id.</param>
    /// <param name="policyVersion">The cookie policy version, like <c>1.0</c>.</param>
    /// <param name="stats">True or false when chosen, null when not chosen.</param>
    /// <param name="map">True when the map is allowed.</param>
    /// <param name="gpc">True when the browser sent the GPC signal.</param>
    /// <param name="source">Where the decision was made.</param>
    /// <param name="decidedAtUtc">The server time of the decision.</param>
    /// <returns>The new, unsaved record.</returns>
    /// <exception cref="ArgumentException">The chain id is empty, the policy version is not digits, a dot and digits within the column length, or stats are on under GPC.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The source is not a named one.</exception>
    public static ConsentRecord Decide(Guid consentId, string policyVersion, bool? stats, bool map, bool gpc, ConsentSource source, DateTimeOffset decidedAtUtc)
    {
        if (consentId == Guid.Empty)
        {
            throw new ArgumentException("The consent chain id is empty.", nameof(consentId));
        }

        if (!IsVersion(policyVersion))
        {
            throw new ArgumentException("The policy version must be digits, a dot and digits, like 1.0.", nameof(policyVersion));
        }

        if (gpc && stats == true)
        {
            throw new ArgumentException("Visitor stats cannot be on when the browser sent the GPC signal.", nameof(stats));
        }

        if (!Enum.IsDefined(source))
        {
            throw new ArgumentOutOfRangeException(nameof(source), source, "Unknown consent source.");
        }

        return new ConsentRecord
        {
            Id = Guid.CreateVersion7(decidedAtUtc),
            ConsentId = consentId,
            PolicyVersion = policyVersion,
            Stats = stats,
            Map = map,
            Gpc = gpc,
            Source = source,
            DecidedAtUtc = decidedAtUtc,
        };
    }

    // "digits.digits" within the column length, like "1.0".
    private static bool IsVersion(string? text)
    {
        if (string.IsNullOrEmpty(text) || text.Length > PolicyVersionMaxLength)
        {
            return false;
        }

        var dot = text.IndexOf('.', StringComparison.Ordinal);
        return dot > 0 && dot < text.Length - 1 && text.Where((_, index) => index != dot).All(char.IsAsciiDigit);
    }
}

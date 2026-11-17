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
    public static ConsentRecord Decide(Guid consentId, string policyVersion, bool? stats, bool map, bool gpc, ConsentSource source, DateTimeOffset decidedAtUtc) =>
        new();
}

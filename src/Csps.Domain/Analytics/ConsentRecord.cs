namespace Csps.Domain.Analytics;

/// <summary>
/// One cookie decision, kept as proof of consent (ANL-07). Nothing writes this table any more (D-80); the entity stays so the cleanup job
/// can remove old rows (D-05). It stores no address and no browser name (PRD section 5.4).
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

    /// <summary>Gets the stored source number (1 bar, 2 settings, 3 map link, 4 clear).</summary>
    public byte Source { get; private set; }

    /// <summary>Gets the server time of the decision.</summary>
    public DateTimeOffset DecidedAtUtc { get; private set; }
}

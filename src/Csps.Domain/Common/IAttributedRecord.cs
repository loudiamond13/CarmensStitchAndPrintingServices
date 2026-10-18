namespace Csps.Domain.Common;

/// <summary>
/// A record that says who created and who last changed it, and when (SEC-08). The server sets all four values in one
/// place from the signed-in user and the clock; no request can supply them. A null id reads as System (the bootstrap
/// account, tools and rows from before attribution existed). The name shown is read from the user row at display time (D-08).
/// </summary>
public interface IAttributedRecord
{
    /// <summary>Gets who created the record; null reads as System.</summary>
    Guid? CreatedById { get; }

    /// <summary>Gets when the record was created, in UTC.</summary>
    DateTimeOffset CreatedAtUtc { get; }

    /// <summary>Gets who last edited the record; null reads as System, or the record was never edited.</summary>
    Guid? UpdatedById { get; }

    /// <summary>Gets when the record was last edited, in UTC; null if never.</summary>
    DateTimeOffset? UpdatedAtUtc { get; }
}

namespace Csps.Domain.Identity;

/// <summary>
/// The one "Legacy / unassigned" holder row (D-37). Legacy money with no known person points at it. It can never sign in
/// (no email, no password, no role, inactive) and is never chosen or listed: only the legacy import may use it. Every value is a
/// literal, never a clock read or a new Guid, so the migration seed and the EF model stay stable.
/// </summary>
public static class LegacyHolder
{
    /// <summary>The fixed id of the holder row.</summary>
    public static readonly Guid Id = new("18ed889a-b94d-42f5-a5b0-ee2f47b437cd");

    /// <summary>The holder's first name.</summary>
    public const string FirstName = "Legacy";

    /// <summary>The holder's last name; joined to the first name it reads <see cref="DisplayName"/>.</summary>
    public const string LastName = "/ unassigned";

    /// <summary>The name every person lookup shows for the holder.</summary>
    public const string DisplayName = "Legacy / unassigned";

    /// <summary>The fixed edit version of the holder row.</summary>
    public static readonly Guid EditVersion = new("4094c10f-b3f9-4b9b-8368-ab918b46a3b2");

    /// <summary>The fixed security stamp, plain uppercase GUID text.</summary>
    public const string SecurityStamp = "D794185C-717C-4A46-AFFF-FFC9616BFFE8";

    /// <summary>The fixed concurrency stamp, plain uppercase GUID text.</summary>
    public const string ConcurrencyStamp = "1C1442FA-A6FF-48DD-A9DC-A9D8E061C456";

    /// <summary>The fixed creation stamp of the holder row.</summary>
    public static readonly DateTimeOffset CreatedAtUtc = new(2026, 10, 28, 0, 0, 0, TimeSpan.Zero);
}

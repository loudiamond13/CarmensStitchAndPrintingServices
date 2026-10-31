using System.Globalization;

namespace Csps.Application.Users;

/// <summary>
/// The address a deleted person's row is left with (D-07). It is unique per id, so the real address is free for a new invitation (D-10),
/// it sits in the reserved <c>.invalid</c> domain (RFC 2606), so no mail can ever reach it, and it passes the same email and user-name
/// checks as any other address.
/// </summary>
public static class DeletedAddress
{
    /// <summary>The reserved domain every scrambled address uses.</summary>
    public const string Domain = "deleted.invalid";

    /// <summary>Builds the scrambled address of a person.</summary>
    /// <param name="id">The account id.</param>
    /// <returns><c>deleted-{id in N format}@deleted.invalid</c>.</returns>
    public static string For(Guid id) => string.Create(CultureInfo.InvariantCulture, $"deleted-{id:N}@{Domain}");
}

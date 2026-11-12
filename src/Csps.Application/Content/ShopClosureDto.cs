using System.Globalization;
using Csps.Application.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// One closure as a Manager sees it (CONT-04): the days as "yyyy-MM-dd", the public note and the version a save must send back.
/// </summary>
/// <param name="Id">The closure id.</param>
/// <param name="FirstDay">The first closed day, "yyyy-MM-dd".</param>
/// <param name="LastDay">The last closed day, "yyyy-MM-dd"; the same as the first for a single day.</param>
/// <param name="Note">A short reason shown to visitors; null when there is none.</param>
/// <param name="Version">The text a save must send back (409 on a stale one).</param>
public sealed record ShopClosureDto(Guid Id, string FirstDay, string LastDay, string? Note, string Version)
{
    /// <summary>The text form of a day.</summary>
    public const string DateFormat = "yyyy-MM-dd";

    /// <summary>Writes a day as "yyyy-MM-dd".</summary>
    /// <param name="day">The day.</param>
    /// <returns>The text.</returns>
    public static string FormatDay(DateOnly day) => day.ToString(DateFormat, CultureInfo.InvariantCulture);

    /// <summary>Maps a closure to the DTO (manual mapping, PRD section 3.3).</summary>
    /// <param name="closure">The closure.</param>
    /// <returns>The DTO.</returns>
    public static ShopClosureDto From(ShopClosure closure)
    {
        ArgumentNullException.ThrowIfNull(closure);
        return new ShopClosureDto(closure.Id, FormatDay(closure.FirstDay), FormatDay(closure.LastDay), closure.Note, RowVersions.ToText(closure.RowVersion));
    }
}

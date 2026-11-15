namespace Csps.Domain.Content;

/// <summary>
/// A holiday or closure (CONT-04): the shop is closed all day on every day from <paramref name="FirstDay"/> to
/// <paramref name="LastDay"/>, both included.
/// </summary>
/// <param name="FirstDay">The first closed day.</param>
/// <param name="LastDay">The last closed day.</param>
/// <param name="Note">A short reason shown to visitors, or null.</param>
public sealed record ClosureSpan(DateOnly FirstDay, DateOnly LastDay, string? Note)
{
    /// <summary>Returns true when <paramref name="day"/> is inside this closure.</summary>
    /// <param name="day">A business day.</param>
    /// <returns>True when the shop is closed on that day because of this closure.</returns>
    public bool Covers(DateOnly day) => day >= FirstDay && day <= LastDay;
}

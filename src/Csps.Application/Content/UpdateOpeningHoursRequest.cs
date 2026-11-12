namespace Csps.Application.Content;

/// <summary>
/// The weekly hours form (CONT-01, SEC-07). All seven days are sent every time. Any other member in the body is ignored: who changed the
/// hours and when come from the token and the clock (SEC-08).
/// </summary>
/// <param name="Version">The week version the form was opened with; required.</param>
/// <param name="Days">The seven days, each once, in any order; a closed day has no times.</param>
public sealed record UpdateOpeningHoursRequest(string? Version, IReadOnlyList<DayHoursDto>? Days)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing part.</summary>
    public static UpdateOpeningHoursRequest Empty { get; } = new(null, null);
}

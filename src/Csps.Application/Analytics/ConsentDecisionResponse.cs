namespace Csps.Application.Analytics;

/// <summary>The state after a decision, as the server stored it (ANL-07). The browser shows this, not what it sent.</summary>
/// <param name="ConsentId">The consent chain id.</param>
/// <param name="PolicyVersion">The policy version the decision was made under.</param>
/// <param name="Stats">True or false when chosen, null when not chosen.</param>
/// <param name="Map">True when the map is allowed.</param>
/// <param name="Gpc">True when the browser sent the Global Privacy Control signal.</param>
/// <param name="DecidedOn">The business day of the decision, as <c>yyyy-MM-dd</c>.</param>
public sealed record ConsentDecisionResponse(string ConsentId, string PolicyVersion, bool? Stats, bool Map, bool Gpc, string DecidedOn);

namespace Csps.Application.Analytics;

/// <summary>What the controller needs to answer a decision: the stored state, the consent cookie and what to do with the visitor id.</summary>
/// <param name="Response">The state after the decision.</param>
/// <param name="CookieValue">The value of the consent cookie (the pending marker is never set).</param>
/// <param name="ExpiresAt">When the cookies expire: 12 months after the decision.</param>
/// <param name="Visitor">What to do with the visitor id cookie.</param>
/// <param name="VisitorToken">The new visitor id when <paramref name="Visitor"/> is <see cref="VisitorIdAction.Issue"/>; otherwise null.</param>
public sealed record ConsentOutcome(ConsentDecisionResponse Response, string CookieValue, DateTimeOffset ExpiresAt, VisitorIdAction Visitor, string? VisitorToken);

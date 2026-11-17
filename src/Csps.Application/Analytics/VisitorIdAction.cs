namespace Csps.Application.Analytics;

/// <summary>What a decision does to the visitor id cookie (ANL-05, D-41).</summary>
public enum VisitorIdAction
{
    /// <summary>Leave the cookie as it is.</summary>
    Keep,

    /// <summary>Give the browser a new visitor id.</summary>
    Issue,

    /// <summary>Take the visitor id away. Past analytics rows stay (D-41).</summary>
    Expire,
}

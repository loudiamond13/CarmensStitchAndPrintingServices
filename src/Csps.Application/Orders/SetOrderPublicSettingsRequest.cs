namespace Csps.Application.Orders;

/// <summary>
/// The Public Website window of an order (D-09 to D-16). It carries the version the window was opened with. Any other member in the body,
/// such as a forged consent time or person, is ignored: who recorded the customer's OK and when come from the token and the clock.
/// </summary>
/// <param name="Version">The base64 of the eight-byte row version the window was opened with.</param>
/// <param name="CustomerConsent">True when the customer said OK to show.</param>
/// <param name="ShowOnWebsite">True to show the order on the website; needs the customer's OK.</param>
/// <param name="ProductLineId">The line to show the order under; null to use the auto line from the items.</param>
/// <param name="PublicName">The name shown instead of the team, at most 80 characters; null or empty to show the team.</param>
public sealed record SetOrderPublicSettingsRequest(string? Version, bool CustomerConsent, bool ShowOnWebsite, Guid? ProductLineId, string? PublicName) : IOrderPublicWebsiteFields
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static SetOrderPublicSettingsRequest Empty { get; } = new(null, false, false, null, null);
}

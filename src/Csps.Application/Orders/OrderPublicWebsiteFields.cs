using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>The public website fields the order window, the New Order form and the Edit Order form share, so one validator checks all three (D-11, D-13).</summary>
public interface IOrderPublicWebsiteFields
{
    /// <summary>Gets a value indicating whether the customer said OK to show.</summary>
    bool CustomerConsent { get; }

    /// <summary>Gets a value indicating whether to show the order on the website; needs the customer's OK.</summary>
    bool ShowOnWebsite { get; }

    /// <summary>Gets the line to show the order under; null to use the auto line from the items.</summary>
    Guid? ProductLineId { get; }

    /// <summary>Gets the name shown instead of the team, at most 80 characters; null or empty to show the team.</summary>
    string? PublicName { get; }
}

/// <summary>
/// The optional <c>publicWebsite</c> block of the New Order and Edit Order forms (UI-SPEC F1, F2). Any other member in the block, such as a
/// forged consent time or person, is ignored: who recorded the customer's OK and when come from the token and the clock (D-11).
/// </summary>
/// <param name="CustomerConsent">True when the customer said OK to show.</param>
/// <param name="ShowOnWebsite">True to show the order on the website; needs the customer's OK.</param>
/// <param name="ProductLineId">The line to show the order under; null to use the auto line from the items.</param>
/// <param name="PublicName">The name shown instead of the team, at most 80 characters; null or empty to show the team.</param>
public sealed record OrderPublicWebsiteFields(bool CustomerConsent, bool ShowOnWebsite, Guid? ProductLineId, string? PublicName) : IOrderPublicWebsiteFields
{
    /// <summary>The prefix of the block's fields in a 400 answer, so a form maps each message to its own control.</summary>
    public const string FieldPrefix = "publicWebsite.";

    /// <summary>Tells whether the block sets nothing: no OK, no show, no line and no name. A method, so it stays out of the JSON contract.</summary>
    /// <returns>True when nothing is set.</returns>
    public bool SetsNothing() => !CustomerConsent && !ShowOnWebsite && ProductLineId is null && string.IsNullOrWhiteSpace(PublicName);

    /// <summary>Gets the block as the domain's settings.</summary>
    /// <returns>The settings.</returns>
    public OrderPublicSettings ToSettings() => new(CustomerConsent, ShowOnWebsite, ProductLineId, PublicName);
}

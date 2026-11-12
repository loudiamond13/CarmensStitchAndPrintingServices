namespace Csps.Domain.Orders;

/// <summary>
/// What staff set for an order's place on the public website (D-09 to D-16): whether the customer said OK, whether it shows, the line it
/// shows under and the name shown. The consent's who and when are never part of this: they come from the token and the clock.
/// </summary>
/// <param name="CustomerConsent">True when the customer said OK to show.</param>
/// <param name="ShowOnWebsite">True to show the order on the website.</param>
/// <param name="ProductLineId">The line to show the order under; null to use the auto line.</param>
/// <param name="PublicName">The name shown instead of the team; null or empty to show the team.</param>
public sealed record OrderPublicSettings(bool CustomerConsent, bool ShowOnWebsite, Guid? ProductLineId, string? PublicName)
{
    /// <summary>The longest name shown.</summary>
    public const int PublicNameMaxLength = 80;

    /// <summary>The field of the show flag in an error.</summary>
    public const string ShowField = "showOnWebsite";

    /// <summary>The field of the line in an error.</summary>
    public const string LineField = "productLineId";

    /// <summary>The field of the name shown in an error.</summary>
    public const string NameField = "publicName";

    /// <summary>The code of a save on a Cancelled order.</summary>
    public const string CancelledCode = "orders.public-cancelled";

    /// <summary>The message for showing without the customer's OK (D-11).</summary>
    public const string ConsentRequiredMessage = "Tick Customer said OK to show first.";

    /// <summary>The message for a Cancelled order (D-38).</summary>
    public const string CancelledMessage = "Cancelled orders can't be shown on the website.";

    /// <summary>The message for showing an order that has no line to show it under (D-09).</summary>
    public const string LineRequiredMessage = "Choose the product line to show this order under.";

    /// <summary>The message for a name shown that is missing on an order with no team (D-13).</summary>
    public const string NameRequiredMessage = "This order has no team name. Enter the name to show.";

    /// <summary>The message for a name shown over the limit (D-13).</summary>
    public const string NameTooLongMessage = "Keep the name to 80 characters or fewer.";
}

/// <summary>
/// What one public settings save changed on an order (AUDIT-01). It carries no customer text: only what happened.
/// </summary>
/// <param name="ConsentChange">True when the customer's OK was recorded now, false when it was removed, null when it stayed.</param>
/// <param name="ShownChange">True when the order was put on the website now, false when it was taken off, null when it stayed.</param>
/// <param name="DetailFields">The names of the details that changed (<c>line</c>, <c>name</c>), in that order.</param>
public sealed record OrderPublicSettingsChanges(bool? ConsentChange, bool? ShownChange, IReadOnlyList<string> DetailFields)
{
    /// <summary>The name of the line in <see cref="DetailFields"/>.</summary>
    public const string LineDetail = "line";

    /// <summary>The name of the name shown in <see cref="DetailFields"/>.</summary>
    public const string NameDetail = "name";

    /// <summary>Gets a value indicating whether anything at all changed.</summary>
    public bool HasAny => ConsentChange is not null || ShownChange is not null || DetailFields.Count > 0;
}

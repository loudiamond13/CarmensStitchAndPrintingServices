namespace Csps.Domain.Content;

/// <summary>One phone number as typed in the business info form.</summary>
/// <param name="Number">What a person typed; parsed by <see cref="PhilippinePhone"/>.</param>
/// <param name="Label">An optional label such as "Globe".</param>
/// <param name="IsMain">True for the number the Call buttons dial.</param>
public sealed record BusinessPhone(string Number, string? Label, bool IsMain);

/// <summary>Everything the business info form sets (CONT-01). An empty optional value clears it.</summary>
/// <param name="BusinessName">The business name; required.</param>
/// <param name="Tagline">The tagline; required.</param>
/// <param name="AboutText">The about text.</param>
/// <param name="TurnaroundLine">The turnaround promise.</param>
/// <param name="Street">Street and barangay.</param>
/// <param name="TownOrCity">Town or city.</param>
/// <param name="Province">Province.</param>
/// <param name="PostalCode">Postal code.</param>
/// <param name="DirectionsUrl">The directions link.</param>
/// <param name="MapEmbedUrl">The map embed link.</param>
/// <param name="MessengerUrl">The Messenger link.</param>
/// <param name="FacebookUrl">The Facebook page link.</param>
/// <param name="InstagramUrl">The Instagram link.</param>
/// <param name="TikTokUrl">The TikTok link.</param>
/// <param name="ContactEmail">The shop's email, for staff only.</param>
/// <param name="QuoteAlertsEmail">The staff inbox that gets an email for each quote request, for staff only (13 D-07).</param>
/// <param name="Phones">The phone numbers, at most <see cref="SitePhoneNumber.MaxCount"/>.</param>
public sealed record BusinessInfo(
    string BusinessName,
    string Tagline,
    string? AboutText,
    string? TurnaroundLine,
    string? Street,
    string? TownOrCity,
    string? Province,
    string? PostalCode,
    string? DirectionsUrl,
    string? MapEmbedUrl,
    string? MessengerUrl,
    string? FacebookUrl,
    string? InstagramUrl,
    string? TikTokUrl,
    string? ContactEmail,
    string? QuoteAlertsEmail,
    IReadOnlyList<BusinessPhone> Phones);

/// <summary>What <see cref="SiteSettings.UpdateBusinessInfo"/> did.</summary>
/// <param name="ChangedFields">The API names of the single-value fields whose value changed, in form order.</param>
/// <param name="Phones">The phone rows that replace the stored list, main number first.</param>
public sealed record BusinessInfoChanges(IReadOnlyList<string> ChangedFields, IReadOnlyList<SitePhoneNumber> Phones);

/// <summary>The API names of the business info fields, used as keys in field errors and in the changed-field list.</summary>
public static class BusinessInfoFields
{
    /// <summary>The business name.</summary>
    public const string BusinessName = "businessName";

    /// <summary>The tagline.</summary>
    public const string Tagline = "tagline";

    /// <summary>The about text.</summary>
    public const string AboutText = "aboutText";

    /// <summary>The turnaround line.</summary>
    public const string TurnaroundLine = "turnaroundLine";

    /// <summary>The street.</summary>
    public const string Street = "street";

    /// <summary>The town or city.</summary>
    public const string TownOrCity = "townOrCity";

    /// <summary>The province.</summary>
    public const string Province = "province";

    /// <summary>The postal code.</summary>
    public const string PostalCode = "postalCode";

    /// <summary>The directions link.</summary>
    public const string DirectionsUrl = "directionsUrl";

    /// <summary>The map embed link.</summary>
    public const string MapEmbedUrl = "mapEmbedUrl";

    /// <summary>The Messenger link.</summary>
    public const string MessengerUrl = "messengerUrl";

    /// <summary>The Facebook link.</summary>
    public const string FacebookUrl = "facebookUrl";

    /// <summary>The Instagram link.</summary>
    public const string InstagramUrl = "instagramUrl";

    /// <summary>The TikTok link.</summary>
    public const string TiktokUrl = "tiktokUrl";

    /// <summary>The shop email.</summary>
    public const string ContactEmail = "contactEmail";

    /// <summary>The quote alerts email.</summary>
    public const string QuoteAlertsEmail = "quoteAlertsEmail";

    /// <summary>The phone list.</summary>
    public const string Phones = "phones";
}

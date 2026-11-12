namespace Csps.Application.Content;

/// <summary>One public phone number.</summary>
/// <param name="Display">The number as people read it, such as "0917 123 4567".</param>
/// <param name="E164">The number for a <c>tel:</c> link, such as "+639171234567".</param>
/// <param name="Label">An optional label such as "Globe"; null when not set.</param>
/// <param name="IsMain">True for the number the Call buttons dial; the main number is listed first.</param>
public sealed record PublicPhoneDto(string Display, string E164, string? Label, bool IsMain);

/// <summary>The shop address as parts; a part that is not set is null.</summary>
/// <param name="Street">Street and barangay.</param>
/// <param name="TownOrCity">Town or city.</param>
/// <param name="Province">Province.</param>
/// <param name="PostalCode">Postal code.</param>
public sealed record PublicAddressDto(string? Street, string? TownOrCity, string? Province, string? PostalCode);

/// <summary>
/// The shop facts every visitor sees (PUB-02): name, words, address, phones and links. It carries nothing private; the shop email is
/// not a member (D-25). A value that is not set is null and the page leaves it out.
/// </summary>
/// <param name="BusinessName">The business name.</param>
/// <param name="Tagline">The tagline.</param>
/// <param name="AboutText">The about text, used in search results.</param>
/// <param name="TurnaroundLine">The turnaround promise; null makes no time promise.</param>
/// <param name="Address">The address parts.</param>
/// <param name="Phones">The phone numbers, the main one first.</param>
/// <param name="MessengerUrl">The Messenger link.</param>
/// <param name="FacebookUrl">The Facebook page link.</param>
/// <param name="InstagramUrl">The Instagram link.</param>
/// <param name="TiktokUrl">The TikTok link.</param>
/// <param name="DirectionsUrl">The directions link.</param>
/// <param name="MapEmbedUrl">The map embed link.</param>
/// <param name="Year">The current business-calendar year, for the footer's copyright line.</param>
public sealed record PublicSiteDto(
    string BusinessName,
    string Tagline,
    string? AboutText,
    string? TurnaroundLine,
    PublicAddressDto Address,
    IReadOnlyList<PublicPhoneDto> Phones,
    string? MessengerUrl,
    string? FacebookUrl,
    string? InstagramUrl,
    string? TiktokUrl,
    string? DirectionsUrl,
    string? MapEmbedUrl,
    int Year);

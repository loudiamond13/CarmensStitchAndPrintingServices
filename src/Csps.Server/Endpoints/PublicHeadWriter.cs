using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Unicode;
using Csps.Application.Content;
using Csps.Domain.Content;

namespace Csps.Server.Endpoints;

/// <summary>What one page's head block says.</summary>
/// <param name="Title">The <c>title</c> text.</param>
/// <param name="Description">The meta description.</param>
/// <param name="CanonicalUrl">The absolute canonical address, or null for a page with no canonical (the 404 page).</param>
/// <param name="SiteName">The business name for <c>og:site_name</c>; left out when null or empty.</param>
/// <param name="NoIndex">Whether the page asks search engines to skip it.</param>
/// <param name="JsonLd">The <c>LocalBusiness</c> JSON-LD text from <see cref="PublicHeadWriter.LocalBusinessJsonLd"/>; none when null.</param>
/// <param name="BootJson">The boot data text from <see cref="PublicHeadWriter.BootData"/>; none when null.</param>
/// <param name="ShareImageUrl">The absolute address of the 1200 x 630 link preview picture; the picture tags are left out when null.</param>
internal sealed record PublicHeadModel(
    string Title,
    string Description,
    string? CanonicalUrl,
    string? SiteName,
    bool NoIndex,
    string? JsonLd = null,
    string? BootJson = null,
    string? ShareImageUrl = null);

/// <summary>
/// Writes a page's head block as HTML (PUB-04, D-42). Every attribute value goes through an HTML encoder, and every script block holds
/// JSON written by <see cref="JsonSerializer"/> with its default encoder, which escapes <c>&lt;</c>, <c>&gt;</c> and <c>&amp;</c>, so
/// typed text can never close a script block (CWE-79). Addresses come from the model, which is built from <c>App:PublicBaseUrl</c> and
/// the route table, never from the request.
/// </summary>
internal static class PublicHeadWriter
{
    /// <summary>The robots directive for pages that must stay out of search results.</summary>
    public const string NoIndexValue = "noindex, nofollow";

    /// <summary>The id of the data block the client reads once instead of fetching the site facts (D-42).</summary>
    public const string BootBlockId = "csps-boot";

    private const string LineBreak = "\n    ";

    // The size of the link preview picture, the csps_share_1200 named size.
    private const string ShareWidth = "1200";
    private const string ShareHeight = "630";

    // The default encoder escapes every non-ASCII letter. Latin-1 stays readable (the middle dot in the titles); the five
    // markup characters are always escaped whatever the allowed ranges.
    private static readonly HtmlEncoder Encoder = HtmlEncoder.Create(UnicodeRanges.BasicLatin, UnicodeRanges.Latin1Supplement);

    // Default JSON encoder on purpose: it is the one that escapes < > & and the quote characters for use inside HTML.
    private static readonly JsonSerializerOptions JsonLdOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>
    /// Appends the head tags for <paramref name="model"/>. The first tag has no indent (the template's own indent comes
    /// before it); each next tag starts on a new line. The share-preview tags come first, the data blocks last.
    /// </summary>
    /// <param name="head">The builder to append to.</param>
    /// <param name="model">The page's head.</param>
    public static void Write(StringBuilder head, PublicHeadModel model)
    {
        ArgumentNullException.ThrowIfNull(head);
        ArgumentNullException.ThrowIfNull(model);

        head.Append("<title>").Append(Encoder.Encode(model.Title)).Append("</title>");
        AppendMeta(head, "name", "description", model.Description);

        if (model.CanonicalUrl is { } canonical)
        {
            head.Append(LineBreak).Append("<link rel=\"canonical\" href=\"").Append(Encoder.Encode(canonical)).Append("\">");
            AppendMeta(head, "property", "og:type", "website");
            if (!string.IsNullOrEmpty(model.SiteName))
            {
                AppendMeta(head, "property", "og:site_name", model.SiteName);
            }

            AppendMeta(head, "property", "og:locale", "en_PH");
            AppendMeta(head, "property", "og:title", model.Title);
            AppendMeta(head, "property", "og:description", model.Description);
            AppendMeta(head, "property", "og:url", canonical);
            AppendSharePicture(head, model);
        }

        if (model.NoIndex)
        {
            AppendRobots(head);
        }

        if (model.JsonLd is { } jsonLd)
        {
            head.Append(LineBreak).Append("<script type=\"application/ld+json\">").Append(jsonLd).Append("</script>");
        }

        if (model.BootJson is { } boot)
        {
            head.Append(LineBreak).Append("<script type=\"application/json\" id=\"").Append(BootBlockId).Append("\">").Append(boot).Append("</script>");
        }
    }

    /// <summary>Appends the noindex robots meta tag on a new line.</summary>
    /// <param name="head">The builder to append to.</param>
    public static void AppendRobots(StringBuilder head)
    {
        ArgumentNullException.ThrowIfNull(head);
        AppendMeta(head, "name", "robots", NoIndexValue);
    }

    /// <summary>
    /// Builds the <c>LocalBusiness</c> JSON-LD of a page from a typed model (D-25): name, description (the about text, else the tagline),
    /// url, the main number as an E.164 telephone, a <c>PostalAddress</c> in the Philippines when any address part is set, and the social
    /// links that are set. A value that is not set is left out. The model has no contact-mail member, so none can be written.
    /// Each open weekday adds an <c>OpeningHoursSpecification</c> with its day name and its opening and closing times, and each closure
    /// adds a <c>specialOpeningHoursSpecification</c> closed day with <c>opens</c> and <c>closes</c> both "00:00" and its first and last
    /// day as <c>validFrom</c> and <c>validThrough</c> (PUB-04, CONT-04). The closure notes are never written here.
    /// </summary>
    /// <param name="site">The public site facts.</param>
    /// <param name="closures">The closures to list as closed days, by first day: the ones that touch the next 60 days.</param>
    /// <param name="origin">The site's own address, from <c>App:PublicBaseUrl</c>, without a trailing slash.</param>
    /// <returns>The JSON text, safe inside a script block.</returns>
    public static string LocalBusinessJsonLd(PublicSiteDto site, IReadOnlyList<ClosureSpan> closures, string origin)
    {
        ArgumentNullException.ThrowIfNull(site);
        ArgumentNullException.ThrowIfNull(closures);
        ArgumentNullException.ThrowIfNull(origin);

        var main = site.Phones.FirstOrDefault(phone => phone.IsMain) ?? (site.Phones.Count > 0 ? site.Phones[0] : null);
        var sameAs = new[] { site.FacebookUrl, site.InstagramUrl, site.TiktokUrl }.OfType<string>().ToList();
        var business = new LocalBusinessModel(
            "https://schema.org",
            "LocalBusiness",
            site.BusinessName,
            site.AboutText ?? site.Tagline,
            origin,
            main?.E164,
            AddressModel.From(site.Address),
            HoursModel.From(site.Hours),
            ClosedDayModel.From(closures),
            sameAs.Count > 0 ? sameAs : null);
        return JsonSerializer.Serialize(business, JsonLdOptions);
    }

    /// <summary>
    /// Wraps the site JSON the API serves as <c>{ "site": ... }</c> for the boot data block, and the product lines JSON as
    /// <c>"productLines"</c> when the page needs it (the Products page). Both texts are already written by the default JSON encoder, so
    /// they hold no raw <c>&lt;</c>.
    /// </summary>
    /// <param name="siteJson">The site JSON text.</param>
    /// <param name="productLinesJson">The product lines JSON text; the key is left out when null.</param>
    /// <returns>The boot data text.</returns>
    public static string BootData(string siteJson, string? productLinesJson = null)
    {
        ArgumentNullException.ThrowIfNull(siteJson);
        return productLinesJson is null
            ? "{\"site\":" + siteJson + "}"
            : "{\"site\":" + siteJson + ",\"productLines\":" + productLinesJson + "}";
    }

    // The picture tags, and the card that goes with them: a large picture card with a picture, the plain summary card without (D-26).
    private static void AppendSharePicture(StringBuilder head, PublicHeadModel model)
    {
        if (model.ShareImageUrl is { } image)
        {
            AppendMeta(head, "property", "og:image", image);
            AppendMeta(head, "property", "og:image:width", ShareWidth);
            AppendMeta(head, "property", "og:image:height", ShareHeight);
            if (!string.IsNullOrEmpty(model.SiteName))
            {
                AppendMeta(head, "property", "og:image:alt", model.SiteName);
            }
        }

        AppendMeta(head, "name", "twitter:card", model.ShareImageUrl is null ? "summary" : "summary_large_image");
    }

    private static void AppendMeta(StringBuilder head, string attribute, string key, string value) =>
        head.Append(LineBreak)
            .Append("<meta ").Append(attribute).Append("=\"").Append(key).Append("\" content=\"").Append(Encoder.Encode(value)).Append("\">");

    private sealed record LocalBusinessModel(
        [property: JsonPropertyName("@context")] string Context,
        [property: JsonPropertyName("@type")] string Type,
        string Name,
        string Description,
        string Url,
        string? Telephone,
        AddressModel? Address,
        IReadOnlyList<HoursModel>? OpeningHoursSpecification,
        IReadOnlyList<ClosedDayModel>? SpecialOpeningHoursSpecification,
        IReadOnlyList<string>? SameAs);

    // One closed day or run of days for each closure, written under the JSON key specialOpeningHoursSpecification; null when there is
    // none, so the key is left out. A closed day is written as opening and closing at "00:00".
    private sealed record ClosedDayModel(
        [property: JsonPropertyName("@type")] string Type,
        string Opens,
        string Closes,
        string ValidFrom,
        string ValidThrough)
    {
        private const string Midnight = "00:00";

        public static List<ClosedDayModel>? From(IReadOnlyList<ClosureSpan> closures)
        {
            var days = closures
                .OrderBy(static closure => closure.FirstDay)
                .Select(static closure => new ClosedDayModel(
                    "OpeningHoursSpecification",
                    Midnight,
                    Midnight,
                    ShopClosureDto.FormatDay(closure.FirstDay),
                    ShopClosureDto.FormatDay(closure.LastDay)))
                .ToList();
            return days.Count > 0 ? days : null;
        }
    }

    // One entry for each weekday that has both times, written under the JSON key openingHoursSpecification; null when no day is
    // open, so the key is left out.
    private sealed record HoursModel(
        [property: JsonPropertyName("@type")] string Type,
        string DayOfWeek,
        string Opens,
        string Closes)
    {
        public static List<HoursModel>? From(IReadOnlyList<DayHoursDto> hours)
        {
            var open = hours
                .Where(static day => day.OpensAt is not null && day.ClosesAt is not null)
                .OrderBy(static day => day.Day)
                .Select(static day => new HoursModel("OpeningHoursSpecification", WeekDay.FromNumber(day.Day).ToString(), day.OpensAt!, day.ClosesAt!))
                .ToList();
            return open.Count > 0 ? open : null;
        }
    }

    private sealed record AddressModel(
        [property: JsonPropertyName("@type")] string Type,
        string? StreetAddress,
        string? AddressLocality,
        string? AddressRegion,
        string? PostalCode,
        string AddressCountry)
    {
        public static AddressModel? From(PublicAddressDto address) =>
            address.Street is null && address.TownOrCity is null && address.Province is null && address.PostalCode is null
                ? null
                : new AddressModel("PostalAddress", address.Street, address.TownOrCity, address.Province, address.PostalCode, "PH");
    }
}

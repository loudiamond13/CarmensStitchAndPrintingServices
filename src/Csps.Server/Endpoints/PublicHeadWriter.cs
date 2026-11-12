using System.Text;
using System.Text.Encodings.Web;
using System.Text.Unicode;

namespace Csps.Server.Endpoints;

/// <summary>What one page's head block says.</summary>
/// <param name="Title">The <c>title</c> text.</param>
/// <param name="Description">The meta description.</param>
/// <param name="CanonicalUrl">The absolute canonical address, or null for a page with no canonical (the 404 page).</param>
/// <param name="SiteName">The business name for <c>og:site_name</c>; left out when null or empty.</param>
/// <param name="NoIndex">Whether the page asks search engines to skip it.</param>
internal sealed record PublicHeadModel(string Title, string Description, string? CanonicalUrl, string? SiteName, bool NoIndex);

/// <summary>
/// Writes a page's head block as HTML (PUB-04). Every value goes through an HTML encoder (CWE-79). Addresses come from
/// the model, which is built from <c>App:PublicBaseUrl</c> and the route table, never from the request.
/// </summary>
internal static class PublicHeadWriter
{
    /// <summary>The robots directive for pages that must stay out of search results.</summary>
    public const string NoIndexValue = "noindex, nofollow";

    private const string LineBreak = "\n    ";

    // The default encoder escapes every non-ASCII letter. Latin-1 stays readable (the middle dot in the titles); the five
    // markup characters are always escaped whatever the allowed ranges.
    private static readonly HtmlEncoder Encoder = HtmlEncoder.Create(UnicodeRanges.BasicLatin, UnicodeRanges.Latin1Supplement);

    /// <summary>
    /// Appends the head tags for <paramref name="model"/>. The first tag has no indent (the template's own indent comes
    /// before it); each next tag starts on a new line.
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
        }

        if (model.NoIndex)
        {
            AppendRobots(head);
        }
    }

    /// <summary>Appends the noindex robots meta tag on a new line.</summary>
    /// <param name="head">The builder to append to.</param>
    public static void AppendRobots(StringBuilder head)
    {
        ArgumentNullException.ThrowIfNull(head);
        AppendMeta(head, "name", "robots", NoIndexValue);
    }

    private static void AppendMeta(StringBuilder head, string attribute, string key, string value) =>
        head.Append(LineBreak)
            .Append("<meta ").Append(attribute).Append("=\"").Append(key).Append("\" content=\"").Append(Encoder.Encode(value)).Append("\">");
}

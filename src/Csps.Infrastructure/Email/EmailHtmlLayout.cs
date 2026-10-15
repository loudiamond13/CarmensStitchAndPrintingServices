using System.Net;
using System.Text;

namespace Csps.Infrastructure.Email;

/// <summary>One block of an email's body. The text and HTML parts are both built from the same list.</summary>
internal abstract record EmailBlock;

/// <summary>A body paragraph, with an optional link written out after it.</summary>
/// <param name="Text">The sentence.</param>
/// <param name="LinkUrl">An absolute link shown after the sentence, or null.</param>
internal sealed record ParagraphBlock(string Text, string? LinkUrl = null) : EmailBlock;

/// <summary>A small muted line (when and from where a request was made).</summary>
/// <param name="Text">The line.</param>
internal sealed record MetaBlock(string Text) : EmailBlock;

/// <summary>The sign-in code, shown selectable and never as a link.</summary>
/// <param name="Code">The code.</param>
internal sealed record CodeBlock(string Code) : EmailBlock;

/// <summary>Everything one email says, before it is laid out.</summary>
/// <param name="Subject">The subject line (also the HTML title).</param>
/// <param name="Preheader">The hidden inbox preview line.</param>
/// <param name="Heading">The heading.</param>
/// <param name="Blocks">The body, in order.</param>
/// <param name="Button">The one button, or null.</param>
internal sealed record EmailContent(string Subject, string Preheader, string Heading, IReadOnlyList<EmailBlock> Blocks, EmailButton? Button);

/// <summary>
/// The branded HTML frame of every auth email (UI-SPEC "Email Design Contract", D-30): inline styles, role=presentation
/// tables, the logo as an inline CID image and nothing remote. Every value is HTML-encoded (CWE-79).
/// </summary>
internal static class EmailHtmlLayout
{
    /// <summary>The Content-Id of the inline logo.</summary>
    internal const string LogoContentId = "csps-logo";

    /// <summary>The footer's business line.</summary>
    internal const string FooterBusiness = "Carmen's Stitch & Printing Services";

    /// <summary>The footer's automatic-email note.</summary>
    internal const string FooterNote = "This is an automatic email. Replies to this address aren't read.";

    /// <summary>The footer's reason line.</summary>
    internal const string FooterReason = "You're getting this because you have a staff account at CSPS.";

    private const string LogoSource = "cid:csps-logo";
    private const string LogoAlt = "CSPS — Carmen's Stitch & Printing Services";
    private const string FallbackSentence = "If the button doesn't work, copy this link into your browser:";
    private const string Ink = "#3b1f1c";
    private const string BodyFont = "Arial,Helvetica,sans-serif";

    private static readonly Lazy<byte[]> Logo = new(ReadLogo);

    /// <summary>Gets the bytes of the inline logo: a 2x PNG of the horizontal lockup.</summary>
    /// <returns>The PNG.</returns>
    internal static byte[] LogoPng() => Logo.Value;

    /// <summary>Lays <paramref name="content"/> out as the branded HTML document.</summary>
    /// <param name="content">What the email says.</param>
    /// <returns>The HTML.</returns>
    internal static string Render(EmailContent content)
    {
        ArgumentNullException.ThrowIfNull(content);

        var html = new StringBuilder()
            .Append("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n")
            .Append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n")
            .Append("<meta name=\"color-scheme\" content=\"light\">\n<meta name=\"supported-color-schemes\" content=\"light\">\n")
            .Append("<title>").Append(Encode(content.Subject)).Append("</title>\n")
            .Append("<style>@media (max-width:480px){.csps-pad{padding:24px !important}}</style>\n")
            .Append("</head>\n<body style=\"margin:0;padding:0;background-color:#f6dfd1\">\n")
            .Append("<div style=\"display:none;max-height:0;overflow:hidden;mso-hide:all\">").Append(Encode(content.Preheader)).Append("</div>\n")
            .Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background-color:#f6dfd1\">\n")
            .Append("<tr><td align=\"center\" style=\"padding:24px 16px\">\n")
            .Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" ")
            .Append("style=\"max-width:600px;background-color:#fff6f0;border:1px solid #e3c6b7;border-radius:12px\">\n")
            .Append("<tr><td height=\"4\" style=\"height:4px;line-height:4px;background-color:#ff6600;border-radius:12px 12px 0 0\"></td></tr>\n")
            .Append("<tr><td class=\"csps-pad\" style=\"padding:32px\">\n")
            .Append("<img src=\"").Append(LogoSource).Append("\" width=\"180\" alt=\"").Append(Encode(LogoAlt))
            .Append("\" style=\"display:block;width:180px;max-width:100%;height:auto;border:0;margin:0 0 24px 0\">\n")
            .Append("<h1 style=\"margin:0 0 16px 0;font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:24px;line-height:30px;")
            .Append("font-weight:700;text-transform:uppercase;color:").Append(Ink).Append("\">").Append(Encode(content.Heading)).Append("</h1>\n");

        foreach (var block in content.Blocks)
        {
            AppendBlock(html, block);
        }

        if (content.Button is { } button)
        {
            AppendButton(html, button);
        }

        html.Append("</td></tr>\n</table>\n")
            .Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:600px\">\n")
            .Append("<tr><td style=\"padding:16px 0 0 0;font-family:").Append(BodyFont)
            .Append(";font-size:14px;line-height:20px;font-weight:400;color:#7a5248;background-color:#f6dfd1\">")
            .Append(Encode(FooterBusiness)).Append(" &middot; ").Append(Encode(FooterNote)).Append("<br>")
            .Append(Encode(FooterReason)).Append("</td></tr>\n</table>\n")
            .Append("</td></tr>\n</table>\n</body>\n</html>\n");
        return html.ToString();
    }

    private static void AppendBlock(StringBuilder html, EmailBlock block)
    {
        switch (block)
        {
            case ParagraphBlock paragraph:
                html.Append("<p style=\"margin:0 0 16px 0;font-family:").Append(BodyFont)
                    .Append(";font-size:16px;line-height:24px;font-weight:400;color:").Append(Ink).Append("\">")
                    .Append(Encode(paragraph.Text));
                if (paragraph.LinkUrl is { } url)
                {
                    html.Append(' ').Append(Link(url));
                }

                html.Append("</p>\n");
                break;
            case MetaBlock meta:
                html.Append("<p style=\"margin:0 0 16px 0;font-family:").Append(BodyFont)
                    .Append(";font-size:14px;line-height:20px;font-weight:400;color:#6b443c\">").Append(Encode(meta.Text)).Append("</p>\n");
                break;
            case CodeBlock code:
                html.Append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:0 0 16px 0\"><tr>")
                    .Append("<td style=\"font-family:Consolas,'Courier New',monospace;font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;")
                    .Append("color:").Append(Ink).Append(";background-color:#f1e1d7;border:1px solid #9a6c60;border-radius:8px;padding:16px 24px;text-align:left\">")
                    .Append(Encode(code.Code)).Append("</td></tr></table>\n");
                break;
            default:
                throw new NotSupportedException($"{block.GetType().Name} has no layout.");
        }
    }

    // A bulletproof, table-based button, then the link written out for clients that block or break it.
    private static void AppendButton(StringBuilder html, EmailButton button)
    {
        html.Append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:0 0 16px 0\"><tr>")
            .Append("<td align=\"center\" bgcolor=\"#572e2b\" style=\"background-color:#572e2b;border-radius:8px\">")
            .Append("<a href=\"").Append(Encode(button.Url)).Append("\" style=\"display:inline-block;padding:12px 24px;font-family:").Append(BodyFont)
            .Append(";font-size:16px;line-height:20px;font-weight:700;color:#f6dfd1;text-decoration:none;border-radius:8px\">")
            .Append(Encode(button.Label)).Append("</a></td></tr></table>\n")
            .Append("<p style=\"margin:0 0 16px 0;font-family:").Append(BodyFont)
            .Append(";font-size:14px;line-height:20px;font-weight:400;color:#6b443c\">").Append(Encode(FallbackSentence)).Append(' ')
            .Append("<span style=\"color:#a33f00;text-decoration:underline;word-break:break-all\">").Append(Encode(button.Url)).Append("</span></p>\n");
    }

    private static string Link(string url) =>
        $"<a href=\"{Encode(url)}\" style=\"color:#a33f00;text-decoration:underline;word-break:break-all\">{Encode(url)}</a>";

    private static string Encode(string value) => WebUtility.HtmlEncode(value);

    private static byte[] ReadLogo() => Convert.FromBase64String(EmailLogoPng.Base64);
}

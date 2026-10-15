using System.Globalization;
using System.Net;
using System.Text;
using Csps.Application.Email;
using Csps.Application.Ports;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Email;

/// <summary>A rendered email: the subject and both bodies.</summary>
/// <param name="Subject">The subject line.</param>
/// <param name="Text">The plain-text part.</param>
/// <param name="Html">The HTML part.</param>
internal sealed record RenderedEmail(string Subject, string Text, string Html);

/// <summary>
/// Turns an <see cref="AuthEmail"/> into its subject, plain text and HTML (UI-SPEC "Email Design Contract"). Times are
/// business time (D-32), links come from <see cref="AppLinksOptions"/> only (IN-06) and every value is HTML-encoded (CWE-79).
/// </summary>
/// <param name="calendar">Supplies the business time zone.</param>
/// <param name="links">Builds the links.</param>
internal sealed class EmailRenderer(IBusinessCalendar calendar, IOptions<AppLinksOptions> links)
{
    // Invariant culture with a fixed pattern gives the en-PH look without depending on the host's ICU data.
    private const string TimeFormat = "MMM d, yyyy, h:mm tt";

    private const string FooterBusiness = "Carmen's Stitch & Printing Services";
    private const string FooterNote = "This is an automatic email. Replies to this address aren't read.";
    private const string FooterReason = "You're getting this because you have a staff account at CSPS.";

    /// <summary>Renders <paramref name="email"/>.</summary>
    /// <param name="email">The email to render.</param>
    /// <param name="cancellationToken">Cancels the zone lookup.</param>
    /// <returns>The subject, text part and HTML part.</returns>
    /// <exception cref="NotSupportedException">The kind has no template yet.</exception>
    public async ValueTask<RenderedEmail> RenderAsync(AuthEmail email, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(email);

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        return email switch
        {
            SignInCodeEmail code => RenderSignInCode(code, clock.Zone),
            _ => throw new NotSupportedException($"The {email.Kind} email has no template yet."),
        };
    }

    private RenderedEmail RenderSignInCode(SignInCodeEmail email, TimeZoneInfo zone)
    {
        const string Preheader = "It works for 15 minutes. Never share it.";
        const string Instruction = "Enter this code on the CSPS sign-in screen. It works for 15 minutes and only once.";
        const string NotYou = "Didn't try to sign in? Someone may know your password. Reset it now from the sign-in page:";

        var subject = $"{email.Code} is your CSPS sign-in code";
        var from = email.Device.IsKnown ? email.Device.Label : "an unknown browser";
        var requestedLine = $"Requested {Format(email.RequestedAt, zone)} from {from}.";
        var forgotPage = links.Value.ForgotPasswordPage();

        var text = new StringBuilder()
            .Append("Your sign-in code\n\n")
            .Append(email.Code).Append("\n\n")
            .Append(Instruction).Append("\n\n")
            .Append(requestedLine).Append("\n\n")
            .Append(NotYou).Append(' ').Append(forgotPage).Append("\n\n")
            .Append(FooterBusiness).Append(" · ").Append(FooterNote).Append('\n')
            .Append(FooterReason).Append('\n')
            .ToString();

        var html = new StringBuilder()
            .Append("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"color-scheme\" content=\"light\">\n")
            .Append("<title>").Append(Encode(subject)).Append("</title>\n</head>\n<body>\n")
            .Append("<div style=\"display:none;max-height:0;overflow:hidden\">").Append(Encode(Preheader)).Append("</div>\n")
            .Append("<h1>Your sign-in code</h1>\n")
            .Append("<p style=\"font-family:Consolas,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:8px\">")
            .Append(Encode(email.Code)).Append("</p>\n")
            .Append("<p>").Append(Encode(Instruction)).Append("</p>\n")
            .Append("<p>").Append(Encode(requestedLine)).Append("</p>\n")
            .Append("<p>").Append(Encode(NotYou)).Append(" <a href=\"").Append(Encode(forgotPage)).Append("\">").Append(Encode(forgotPage)).Append("</a></p>\n")
            .Append("<p>").Append(Encode(FooterBusiness)).Append(" &middot; ").Append(Encode(FooterNote)).Append("<br>")
            .Append(Encode(FooterReason)).Append("</p>\n")
            .Append("</body>\n</html>\n")
            .ToString();

        return new RenderedEmail(subject, text, html);
    }

    private static string Format(DateTimeOffset instant, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTime(instant, zone).ToString(TimeFormat, CultureInfo.InvariantCulture);

    private static string Encode(string value) => WebUtility.HtmlEncode(value);
}

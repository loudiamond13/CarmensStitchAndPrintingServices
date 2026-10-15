using System.Globalization;
using System.Net;
using System.Text;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Email;

/// <summary>A rendered email: the subject and both bodies.</summary>
/// <param name="Subject">The subject line.</param>
/// <param name="Text">The plain-text part.</param>
/// <param name="Html">The HTML part.</param>
internal sealed record RenderedEmail(string Subject, string Text, string Html);

/// <summary>The one button of a notice email.</summary>
/// <param name="Label">The button text.</param>
/// <param name="Url">The absolute link; also printed as a fallback.</param>
internal sealed record EmailButton(string Label, string Url);

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
    private const string SessionsEndedLine = "For your safety, every device signed in to your account was signed out.";
    private const string FooterReason = "You're getting this because you have a staff account at CSPS.";

    /// <summary>Renders <paramref name="email"/>.</summary>
    /// <param name="email">The email to render.</param>
    /// <param name="cancellationToken">Cancels the zone lookup.</param>
    /// <returns>The subject, text part and HTML part.</returns>
    /// <exception cref="NotSupportedException">The kind has no template.</exception>
    public async ValueTask<RenderedEmail> RenderAsync(AuthEmail email, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(email);

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        return email switch
        {
            SignInCodeEmail code => RenderSignInCode(code, clock.Zone),
            AccountLockedEmail locked => RenderLocked(locked, clock.Zone),
            PasswordResetEmail reset => RenderReset(reset, clock.Zone),
            PasswordChangedEmail changed => RenderChanged(changed, clock.Zone),
            ManagerResetEmail manager => RenderManagerReset(manager, clock.Zone),
            DeactivatedNoticeEmail deactivated => RenderDeactivated(deactivated),
            InviteEmail invite => RenderInvite(invite),
            _ => throw new NotSupportedException($"The {email.Kind} email has no template."),
        };
    }

    private RenderedEmail RenderSignInCode(SignInCodeEmail email, TimeZoneInfo zone)
    {
        const string Preheader = "It works for 15 minutes. Never share it.";
        const string Instruction = "Enter this code on the CSPS sign-in screen. It works for 15 minutes and only once.";
        const string NotYou = "Didn't try to sign in? Someone may know your password. Reset it now from the sign-in page:";

        var subject = $"{email.Code} is your CSPS sign-in code";
        var requestedLine = $"Requested {Format(email.RequestedAt, zone)} from {DeviceLine(email.Device)}.";
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

    private RenderedEmail RenderLocked(AccountLockedEmail email, TimeZoneInfo zone)
    {
        var what = email.Cause == LockoutCause.Code ? "sign-in codes" : "password tries";
        return Compose(
            subject: "Your CSPS account is locked for 15 minutes",
            preheader: "Sign-in is paused after too many wrong tries.",
            heading: "Sign-in paused",
            paragraphs:
            [
                $"There were too many wrong {what} on your account, so we paused sign-in for 15 minutes. You can sign in again after {FormatTime(email.LockedUntil, zone)} on {FormatDate(email.LockedUntil, zone)}.",
                "If this wasn't you, someone may be trying to get into your account. Reset your password.",
            ],
            button: new EmailButton("Reset Password", links.Value.ForgotPasswordPage()));
    }

    private RenderedEmail RenderReset(PasswordResetEmail email, TimeZoneInfo zone) =>
        Compose(
            subject: "Reset your CSPS password",
            preheader: "This link works for 30 minutes.",
            heading: "Reset your password",
            paragraphs:
            [
                $"We got a request to reset the password for {email.To}.",
                $"Requested {Format(email.RequestedAt, zone)} from {DeviceLine(email.Device)}.",
                "This link works for 30 minutes and only once.",
                "Didn't ask for this? Ignore this email. Your password stays the same.",
            ],
            button: new EmailButton("Reset Password", links.Value.ResetPasswordLink(email.Token)));

    private RenderedEmail RenderChanged(PasswordChangedEmail email, TimeZoneInfo zone)
    {
        var paragraphs = new List<string> { $"The password for {email.To} was changed on {Format(email.ChangedAt, zone)}." };
        if (email.SessionsEnded)
        {
            paragraphs.Add(SessionsEndedLine);
        }

        paragraphs.Add("If you did this, there's nothing else to do.");
        paragraphs.Add("If you didn't, reset your password now and tell a Manager.");
        return Compose(
            subject: "Your CSPS password was changed",
            preheader: "If this wasn't you, act now.",
            heading: "Password changed",
            paragraphs: paragraphs,
            button: new EmailButton("Reset Password", links.Value.ForgotPasswordPage()));
    }

    private static RenderedEmail RenderManagerReset(ManagerResetEmail email, TimeZoneInfo zone) =>
        Compose(
            subject: "A Manager reset your CSPS password",
            preheader: "Ask them for your temporary password.",
            heading: "Your password was reset",
            paragraphs:
            [
                $"{email.ManagerName} set a temporary password for your account on {Format(email.ResetAt, zone)}. Ask them for it.",
                "When you sign in with it, you'll choose your own password.",
                SessionsEndedLine,
            ],
            button: null);

    private static RenderedEmail RenderDeactivated(DeactivatedNoticeEmail email) =>
        Compose(
            subject: "Your CSPS password reset request",
            preheader: "Your account is deactivated.",
            heading: "Account deactivated",
            paragraphs:
            [
                $"We got a request to reset the password for {email.To}.",
                "Your account is deactivated. Ask a Manager if you need access.",
            ],
            button: null);

    private RenderedEmail RenderInvite(InviteEmail email) =>
        Compose(
            subject: "Set up your CSPS staff account",
            preheader: "Choose your password to get started.",
            heading: "You're invited",
            paragraphs:
            [
                $"A staff account at {FooterBusiness} was set up for {email.To}. Set your password to start using CSPS Admin.",
                "This link works for 72 hours and only once. If it expires, ask a Manager to send a new invite.",
                "Each time you sign in, we'll also email you a 6-digit code.",
            ],
            button: new EmailButton("Set Your Password", links.Value.AcceptInviteLink(email.Token)));

    // One frame for the notice kinds: heading, paragraphs, and an optional button whose link is also written out as a fallback.
    private static RenderedEmail Compose(string subject, string preheader, string heading, IReadOnlyList<string> paragraphs, EmailButton? button)
    {
        var text = new StringBuilder().Append(heading).Append("\n\n");
        foreach (var paragraph in paragraphs)
        {
            text.Append(paragraph).Append("\n\n");
        }

        if (button is not null)
        {
            text.Append(button.Label).Append(": ").Append(button.Url).Append("\n\n");
        }

        text.Append(FooterBusiness).Append(" · ").Append(FooterNote).Append('\n').Append(FooterReason).Append('\n');

        var html = new StringBuilder()
            .Append("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"color-scheme\" content=\"light\">\n")
            .Append("<title>").Append(Encode(subject)).Append("</title>\n</head>\n<body>\n")
            .Append("<div style=\"display:none;max-height:0;overflow:hidden\">").Append(Encode(preheader)).Append("</div>\n")
            .Append("<h1>").Append(Encode(heading)).Append("</h1>\n");
        foreach (var paragraph in paragraphs)
        {
            html.Append("<p>").Append(Encode(paragraph)).Append("</p>\n");
        }

        if (button is not null)
        {
            html.Append("<p><a href=\"").Append(Encode(button.Url))
                .Append("\" style=\"display:inline-block;padding:12px 24px;background:#1f2937;color:#ffffff;text-decoration:none;border-radius:6px\">")
                .Append(Encode(button.Label)).Append("</a></p>\n")
                .Append("<p>If the button doesn't work, copy this link into your browser: ").Append(Encode(button.Url)).Append("</p>\n");
        }

        html.Append("<p>").Append(Encode(FooterBusiness)).Append(" &middot; ").Append(Encode(FooterNote)).Append("<br>")
            .Append(Encode(FooterReason)).Append("</p>\n</body>\n</html>\n");

        return new RenderedEmail(subject, text.ToString(), html.ToString());
    }

    private static string DeviceLine(DeviceDescription device) => device.IsKnown ? device.Label : "an unknown browser";

    private static string Format(DateTimeOffset instant, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTime(instant, zone).ToString(TimeFormat, CultureInfo.InvariantCulture);

    private static string FormatTime(DateTimeOffset instant, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTime(instant, zone).ToString("h:mm tt", CultureInfo.InvariantCulture);

    private static string FormatDate(DateTimeOffset instant, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTime(instant, zone).ToString("MMM d, yyyy", CultureInfo.InvariantCulture);

    private static string Encode(string value) => WebUtility.HtmlEncode(value);
}

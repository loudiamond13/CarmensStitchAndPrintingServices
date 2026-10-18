using System.Globalization;
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
/// Turns an <see cref="AuthEmail"/> into its subject, plain text and branded HTML (UI-SPEC "Email Design Contract", D-30).
/// Times are business time (D-32), links come from <see cref="AppLinksOptions"/> only (IN-06) and every value is
/// HTML-encoded (CWE-79).
/// </summary>
/// <param name="calendar">Supplies the business time zone.</param>
/// <param name="links">Builds the links.</param>
internal sealed class EmailRenderer(IBusinessCalendar calendar, IOptions<AppLinksOptions> links)
{
    private const int MinutesPerDay = 24 * 60;

    // Invariant culture with a fixed pattern gives the en-PH look without depending on the host's ICU data.
    private const string TimeFormat = "MMM d, yyyy, h:mm tt";

    private const string SessionsEndedLine = "For your safety, every device signed in to your account was signed out.";
    private const string OtherDevicesEndedLine = "For your safety, every other device signed in to your account was signed out.";

    /// <summary>Renders <paramref name="email"/>.</summary>
    /// <param name="email">The email to render.</param>
    /// <param name="cancellationToken">Cancels the zone lookup.</param>
    /// <returns>The subject, text part and HTML part.</returns>
    /// <exception cref="NotSupportedException">The kind has no template.</exception>
    public async ValueTask<RenderedEmail> RenderAsync(AuthEmail email, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(email);

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        return Brand(email switch
        {
            SignInCodeEmail code => SignInCode(code, clock.Zone),
            AccountLockedEmail locked => Locked(locked, clock.Zone),
            PasswordResetEmail reset => Reset(reset, clock.Zone),
            PasswordChangedEmail changed => Changed(changed, clock.Zone),
            ManagerResetEmail manager => ManagerReset(manager, clock.Zone),
            DeactivatedNoticeEmail deactivated => Deactivated(deactivated),
            InviteEmail invite => Invite(invite),
            _ => throw new NotSupportedException($"The {email.Kind} email has no template."),
        });
    }

    private EmailContent SignInCode(SignInCodeEmail email, TimeZoneInfo zone) =>
        new(
            Subject: $"{email.Code} is your CSPS sign-in code",
            Preheader: $"It works for {Span(email.RequestedAt, email.ExpiresAt)}. Never share it.",
            Heading: "Your sign-in code",
            Blocks:
            [
                new CodeBlock(email.Code),
                new ParagraphBlock($"Enter this code on the CSPS sign-in screen. It works for {Span(email.RequestedAt, email.ExpiresAt)} and only once."),
                new MetaBlock($"Requested {Format(email.RequestedAt, zone)} from {DeviceLine(email.Device)}."),
                new ParagraphBlock("Didn't try to sign in? Someone may know your password. Reset it now from the sign-in page:", links.Value.ForgotPasswordPage()),
            ],
            Button: null);

    private EmailContent Locked(AccountLockedEmail email, TimeZoneInfo zone)
    {
        var what = email.Cause == LockoutCause.Code ? "sign-in codes" : "password tries";
        var length = Span(email.LockedFor);
        return new(
            Subject: $"Your CSPS account is locked for {length}",
            Preheader: "Sign-in is paused after too many wrong tries.",
            Heading: "Sign-in paused",
            Blocks:
            [
                new ParagraphBlock(
                    $"There were too many wrong {what} on your account, so we paused sign-in for {length}. You can sign in again after {FormatTime(email.LockedUntil, zone)} on {FormatDate(email.LockedUntil, zone)}."),
                new ParagraphBlock("If this wasn't you, someone may be trying to get into your account. Reset your password."),
            ],
            Button: new EmailButton("Reset Password", links.Value.ForgotPasswordPage()));
    }

    private EmailContent Reset(PasswordResetEmail email, TimeZoneInfo zone) =>
        new(
            Subject: "Reset your CSPS password",
            Preheader: $"This link works for {Span(email.RequestedAt, email.ExpiresAt)}.",
            Heading: "Reset your password",
            Blocks:
            [
                new ParagraphBlock($"We got a request to reset the password for {email.To}.", Strong: email.To),
                new MetaBlock($"Requested {Format(email.RequestedAt, zone)} from {DeviceLine(email.Device)}."),
                new ParagraphBlock($"This link works for {Span(email.RequestedAt, email.ExpiresAt)} and only once."),
                new ParagraphBlock("Didn't ask for this? Ignore this email. Your password stays the same."),
            ],
            Button: new EmailButton("Reset Password", links.Value.ResetPasswordLink(email.Token)));

    private EmailContent Changed(PasswordChangedEmail email, TimeZoneInfo zone)
    {
        var blocks = new List<EmailBlock> { new ParagraphBlock($"The password for {email.To} was changed on {Format(email.ChangedAt, zone)}.", Strong: email.To) };
        if (email.SessionsEnded)
        {
            blocks.Add(new ParagraphBlock(email.OtherDevicesOnly ? OtherDevicesEndedLine : SessionsEndedLine));
        }

        blocks.Add(new ParagraphBlock("If you did this, there's nothing else to do."));
        blocks.Add(new ParagraphBlock("If you didn't, reset your password now and tell a Manager."));
        return new(
            Subject: "Your CSPS password was changed",
            Preheader: "If this wasn't you, act now.",
            Heading: "Password changed",
            Blocks: blocks,
            Button: new EmailButton("Reset Password", links.Value.ForgotPasswordPage()));
    }

    private static EmailContent ManagerReset(ManagerResetEmail email, TimeZoneInfo zone) =>
        new(
            Subject: "A Manager reset your CSPS password",
            Preheader: "Ask them for your temporary password.",
            Heading: "Your password was reset",
            Blocks:
            [
                new ParagraphBlock($"{email.ManagerName} set a temporary password for your account on {Format(email.ResetAt, zone)}. Ask them for it."),
                new ParagraphBlock("When you sign in with it, you'll choose your own password."),
                new ParagraphBlock(SessionsEndedLine),
            ],
            Button: null);

    private static EmailContent Deactivated(DeactivatedNoticeEmail email) =>
        new(
            Subject: "Your CSPS password reset request",
            Preheader: "Your account is deactivated.",
            Heading: "Account deactivated",
            Blocks:
            [
                new ParagraphBlock($"We got a request to reset the password for {email.To}.", Strong: email.To),
                new ParagraphBlock("Your account is deactivated. Ask a Manager if you need access."),
            ],
            Button: null);

    private EmailContent Invite(InviteEmail email) =>
        new(
            Subject: "Set up your CSPS staff account",
            Preheader: "Choose your password to get started.",
            Heading: "You're invited",
            Blocks:
            [
                new ParagraphBlock($"A staff account at {EmailHtmlLayout.FooterBusiness} was set up for {email.To}. Set your password to start using CSPS Admin.", Strong: email.To),
                new ParagraphBlock($"This link works for {Span(email.RequestedAt, email.ExpiresAt)} and only once. If it expires, ask a Manager to send a new invite."),
                new ParagraphBlock("Each time you sign in, we'll also email you a 6-digit code."),
            ],
            Button: new EmailButton("Set Your Password", links.Value.AcceptInviteLink(email.Token)));

    // The branded frame (D-30): the HTML part and the plain-text part are both built from the same blocks.
    private static RenderedEmail Brand(EmailContent content)
    {
        const string Gap = "\n\n";
        var text = new StringBuilder().Append(content.Heading).Append(Gap);
        foreach (var block in content.Blocks)
        {
            text.Append(block switch
            {
                ParagraphBlock { LinkUrl: { } url } paragraph => $"{paragraph.Text} {url}",
                ParagraphBlock paragraph => paragraph.Text,
                MetaBlock meta => meta.Text,
                CodeBlock code => code.Code,
                _ => throw new NotSupportedException($"{block.GetType().Name} has no text form."),
            }).Append(Gap);
        }

        if (content.Button is { } button)
        {
            text.Append(button.Label).Append(": ").Append(button.Url).Append(Gap);
        }

        text.Append(EmailHtmlLayout.FooterBusiness).Append(" · ").Append(EmailHtmlLayout.FooterNote).Append('\n')
            .Append(EmailHtmlLayout.FooterReason).Append('\n');
        return new RenderedEmail(content.Subject, text.ToString(), EmailHtmlLayout.Render(content));
    }

    // A lifetime in the words of the email: whole days from two up as days, other whole hours as hours, else minutes.
    private static string Span(DateTimeOffset from, DateTimeOffset to) => Span(to - from);

    private static string Span(TimeSpan length)
    {
        var minutes = Math.Max(1, (int)Math.Round(length.TotalMinutes));
        if (minutes >= 2 * MinutesPerDay && minutes % MinutesPerDay == 0)
        {
            return Plural(minutes / MinutesPerDay, "day");
        }

        return minutes % 60 == 0
            ? Plural(minutes / 60, "hour")
            : Plural(minutes, "minute");
    }

    private static string Plural(int count, string unit) => count == 1 ? $"1 {unit}" : $"{count.ToString(CultureInfo.InvariantCulture)} {unit}s";

    private static string DeviceLine(DeviceDescription device) => device.IsKnown ? device.Label : "an unknown browser";

    private static string Format(DateTimeOffset instant, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTime(instant, zone).ToString(TimeFormat, CultureInfo.InvariantCulture);

    private static string FormatTime(DateTimeOffset instant, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTime(instant, zone).ToString("h:mm tt", CultureInfo.InvariantCulture);

    private static string FormatDate(DateTimeOffset instant, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTime(instant, zone).ToString("MMM d, yyyy", CultureInfo.InvariantCulture);
}

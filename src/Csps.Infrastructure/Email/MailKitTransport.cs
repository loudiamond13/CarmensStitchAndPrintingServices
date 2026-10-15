using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Csps.Infrastructure.Email;

/// <summary>
/// Sends mail through the business mailbox over required TLS (D-26): STARTTLS or SSL-on-connect, never a plain or
/// opportunistic mode. Certificate checks are MailKit's defaults and are never overridden (CWE-295).
/// </summary>
/// <param name="smtp">The mailbox settings.</param>
/// <param name="sender">The From address and name.</param>
internal sealed class MailKitTransport(IOptions<SmtpOptions> smtp, IOptions<EmailSenderOptions> sender) : IEmailTransport
{
    private const int TimeoutMilliseconds = 30_000;

    /// <summary>Maps a security mode to the only two MailKit options that require TLS.</summary>
    /// <param name="security">The mode.</param>
    /// <returns>The MailKit option.</returns>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="security"/> is not a defined mode.</exception>
    internal static SecureSocketOptions SocketOptionsFor(SmtpSecurity security) => security switch
    {
        SmtpSecurity.StartTls => SecureSocketOptions.StartTls,
        SmtpSecurity.SslOnConnect => SecureSocketOptions.SslOnConnect,
        _ => throw new ArgumentOutOfRangeException(nameof(security), "Only StartTls and SslOnConnect are supported."),
    };

    /// <summary>Builds the message: the business sender, no Reply-To, plain text first and HTML second (with the inline logo when it is used).</summary>
    /// <param name="email">The rendered email.</param>
    /// <param name="sender">The From address and name.</param>
    /// <returns>The message to send.</returns>
    internal static MimeMessage BuildMessage(OutgoingEmail email, EmailSenderOptions sender)
    {
        ArgumentNullException.ThrowIfNull(email);
        ArgumentNullException.ThrowIfNull(sender);

        var message = new MimeMessage { Subject = email.Subject };
        message.From.Add(new MailboxAddress(sender.FromName, sender.FromAddress));
        message.To.Add(MailboxAddress.Parse(email.To));

        var builder = new BodyBuilder { TextBody = email.Text, HtmlBody = email.Html };
        if (email.Html.Contains($"cid:{EmailHtmlLayout.LogoContentId}", StringComparison.Ordinal))
        {
            var logo = builder.LinkedResources.Add("csps-logo.png", EmailHtmlLayout.LogoPng(), new ContentType("image", "png"));
            logo.ContentId = EmailHtmlLayout.LogoContentId;
        }

        message.Body = builder.ToMessageBody();
        return message;
    }

    /// <inheritdoc />
    public async Task SendAsync(OutgoingEmail email, CancellationToken cancellationToken)
    {
        var settings = smtp.Value;
        if (!settings.TryGetSecurity(out var security))
        {
            throw new InvalidOperationException("Smtp:Security must be StartTls or SslOnConnect.");
        }

        using var message = BuildMessage(email, sender.Value);
        using var client = new SmtpClient { Timeout = TimeoutMilliseconds };

        // The host name must match the server certificate; shared hosts present their own server name.
        await client.ConnectAsync(settings.Host, settings.Port, SocketOptionsFor(security), cancellationToken).ConfigureAwait(false);
        await client.AuthenticateAsync(settings.UserName, settings.Password, cancellationToken).ConfigureAwait(false);
        await client.SendAsync(message, cancellationToken).ConfigureAwait(false);
        await client.DisconnectAsync(quit: true, cancellationToken).ConfigureAwait(false);
    }
}

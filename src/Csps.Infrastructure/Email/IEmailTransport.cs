namespace Csps.Infrastructure.Email;

/// <summary>A rendered email ready for a transport.</summary>
/// <param name="To">The recipient address.</param>
/// <param name="Subject">The subject line.</param>
/// <param name="Text">The plain-text part.</param>
/// <param name="Html">The HTML part.</param>
public sealed record OutgoingEmail(string To, string Subject, string Text, string Html)
{
    /// <summary>Prints the recipient only, so a log or debugger never shows a code or link.</summary>
    /// <returns>A short description.</returns>
    public override string ToString() => $"{nameof(OutgoingEmail)} to {To}";
}

/// <summary>Hands one rendered email to a mail server, or to the Testing-only sink.</summary>
public interface IEmailTransport
{
    /// <summary>Sends <paramref name="email"/>; throws when the mail was not accepted.</summary>
    /// <param name="email">The email to send.</param>
    /// <param name="cancellationToken">Cancels the send.</param>
    /// <returns>A task that completes when the mail was accepted.</returns>
    Task SendAsync(OutgoingEmail email, CancellationToken cancellationToken);
}

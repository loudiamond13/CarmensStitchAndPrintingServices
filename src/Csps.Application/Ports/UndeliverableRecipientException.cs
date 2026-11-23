namespace Csps.Application.Ports;

/// <summary>
/// Thrown by <see cref="IEmailOutbox.EnqueueAsync"/> when the recipient is in a domain that can never receive mail, such as a
/// deleted person's scrambled address. The message never repeats the address.
/// </summary>
public sealed class UndeliverableRecipientException()
    : ArgumentException("The recipient is in a domain reserved for names that cannot receive mail.");

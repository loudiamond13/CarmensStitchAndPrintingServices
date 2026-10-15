using Csps.Application.Email;

namespace Csps.Infrastructure.Email;

/// <summary>
/// One queued email (AUTH-13). The subject and both bodies are stored Data-Protection-encrypted and set to null once
/// the mail is sent, failed or expired, so a code or link never stays readable in the database.
/// </summary>
public sealed class EmailOutboxMessage
{
    /// <summary>The longest recipient address stored.</summary>
    public const int ToAddressMaxLength = 256;

    /// <summary>The longest error code stored.</summary>
    public const int ErrorCodeMaxLength = 64;

    private EmailOutboxMessage()
    {
        ToAddress = string.Empty;
        RowVersion = [];
    }

    /// <summary>Gets the version-7 id, which sorts by creation time.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the kind of email.</summary>
    public AuthEmailKind Kind { get; private set; }

    /// <summary>Gets the recipient address.</summary>
    public string ToAddress { get; private set; }

    /// <summary>Gets the encrypted subject; null once the row is closed.</summary>
    public string? ProtectedSubject { get; private set; }

    /// <summary>Gets the encrypted plain-text part; null once the row is closed.</summary>
    public string? ProtectedText { get; private set; }

    /// <summary>Gets the encrypted HTML part; null once the row is closed.</summary>
    public string? ProtectedHtml { get; private set; }

    /// <summary>Gets when the row was queued.</summary>
    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>Gets the moment after which the mail is no longer worth sending.</summary>
    public DateTimeOffset NotAfter { get; private set; }

    /// <summary>Gets how many sends were tried.</summary>
    public int Attempts { get; private set; }

    /// <summary>Gets the earliest moment the next send may be tried.</summary>
    public DateTimeOffset NextAttemptAt { get; private set; }

    /// <summary>Gets when the mail was handed to the transport, or null.</summary>
    public DateTimeOffset? SentAt { get; private set; }

    /// <summary>Gets when the row was given up on, or null.</summary>
    public DateTimeOffset? FailedAt { get; private set; }

    /// <summary>Gets when the row passed <see cref="NotAfter"/> unsent, or null.</summary>
    public DateTimeOffset? ExpiredAt { get; private set; }

    /// <summary>Gets the code of the last send error (never a message), or null.</summary>
    public string? LastErrorCode { get; private set; }

    /// <summary>Gets the concurrency token.</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>Creates a queued row that is due immediately.</summary>
    /// <param name="id">The version-7 id.</param>
    /// <param name="kind">The kind of email.</param>
    /// <param name="toAddress">The recipient address.</param>
    /// <param name="protectedSubject">The encrypted subject.</param>
    /// <param name="protectedText">The encrypted plain-text part.</param>
    /// <param name="protectedHtml">The encrypted HTML part.</param>
    /// <param name="createdAt">When the row is queued.</param>
    /// <param name="notAfter">The moment after which the mail is not worth sending.</param>
    /// <returns>The new row.</returns>
    public static EmailOutboxMessage Queue(
        Guid id,
        AuthEmailKind kind,
        string toAddress,
        string protectedSubject,
        string protectedText,
        string protectedHtml,
        DateTimeOffset createdAt,
        DateTimeOffset notAfter)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toAddress);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(toAddress.Length, ToAddressMaxLength);
        ArgumentNullException.ThrowIfNull(protectedSubject);
        ArgumentNullException.ThrowIfNull(protectedText);
        ArgumentNullException.ThrowIfNull(protectedHtml);

        return new EmailOutboxMessage
        {
            Id = id,
            Kind = kind,
            ToAddress = toAddress,
            ProtectedSubject = protectedSubject,
            ProtectedText = protectedText,
            ProtectedHtml = protectedHtml,
            CreatedAt = createdAt,
            NotAfter = notAfter,
            NextAttemptAt = createdAt,
        };
    }

    /// <summary>Records a successful send and wipes the content.</summary>
    /// <param name="now">The send time.</param>
    public void MarkSent(DateTimeOffset now)
    {
        Attempts++;
        SentAt = now;
        LastErrorCode = null;
        Scrub();
    }

    /// <summary>Records a failed send; the row stays due.</summary>
    /// <param name="errorCode">A short code for the error, never its message.</param>
    public void MarkAttemptFailed(string errorCode)
    {
        Attempts++;
        LastErrorCode = Truncate(errorCode);
    }

    /// <summary>Gives up on the row and wipes the content.</summary>
    /// <param name="now">The time the row was closed.</param>
    /// <param name="errorCode">A short code for the reason, never a message.</param>
    public void MarkFailed(DateTimeOffset now, string errorCode)
    {
        FailedAt = now;
        LastErrorCode = Truncate(errorCode);
        Scrub();
    }

    private static string Truncate(string errorCode) =>
        errorCode.Length <= ErrorCodeMaxLength ? errorCode : errorCode[..ErrorCodeMaxLength];

    private void Scrub()
    {
        ProtectedSubject = null;
        ProtectedText = null;
        ProtectedHtml = null;
    }
}

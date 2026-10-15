#if CSPS_TESTING
namespace Csps.Infrastructure.Email;

/// <summary>One email the Testing sink received.</summary>
/// <param name="Id">The increasing id, for reading only what is new.</param>
/// <param name="To">The recipient address.</param>
/// <param name="Subject">The subject line.</param>
/// <param name="Text">The plain-text part.</param>
/// <param name="Html">The HTML part.</param>
/// <param name="SentAt">When the sink received it.</param>
public sealed record SinkMessage(long Id, string To, string Subject, string Text, string Html, DateTimeOffset SentAt);

/// <summary>
/// The Testing environment's transport (D-27): keeps mail in memory so tests can read it and nothing is ever sent.
/// It exists only in Debug builds (QUAL-05); a Release build has no such type. It never logs content.
/// </summary>
/// <param name="time">The clock.</param>
public sealed class InMemoryEmailSink(TimeProvider time) : IEmailTransport
{
    private const int Capacity = 1000;

    private readonly Lock _gate = new();
    private readonly List<SinkMessage> _messages = [];
    private long _lastId;

    /// <inheritdoc />
    public Task SendAsync(OutgoingEmail email, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(email);

        lock (_gate)
        {
            _messages.Add(new SinkMessage(++_lastId, email.To, email.Subject, email.Text, email.Html, time.GetUtcNow()));
            if (_messages.Count > Capacity)
            {
                _messages.RemoveAt(0);
            }
        }

        return Task.CompletedTask;
    }

    /// <summary>Returns the messages received after <paramref name="cursor"/>, oldest first.</summary>
    /// <param name="cursor">The id of the last message already seen; 0 returns everything.</param>
    /// <param name="to">When set, only mail to this address (case ignored).</param>
    /// <returns>A snapshot of the matching messages.</returns>
    public IReadOnlyList<SinkMessage> After(long cursor, string? to)
    {
        lock (_gate)
        {
            return [.. _messages.Where(message =>
                message.Id > cursor && (to is null || string.Equals(message.To, to, StringComparison.OrdinalIgnoreCase)))];
        }
    }
}
#endif

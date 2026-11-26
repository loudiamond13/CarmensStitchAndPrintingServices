namespace Csps.Application.Ports;

/// <summary>Counts the quote form sends the bot guard caught, with a reason code and nothing else (D-25, CWE-532).</summary>
public interface IQuoteBotCatchLog
{
    /// <summary>Writes one log line for a caught send.</summary>
    /// <param name="reason">The reason code, one of <see cref="QuoteBotCatchReasons"/>.</param>
    void Caught(string reason);
}

/// <summary>The reason codes of a caught send.</summary>
public static class QuoteBotCatchReasons
{
    /// <summary>The hidden field was filled.</summary>
    public const string Honeypot = "honeypot";

    /// <summary>The ticket was younger than the minimum time.</summary>
    public const string TooFast = "too-fast";
}

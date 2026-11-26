using Csps.Application.Ports;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.QuoteRequests;

/// <summary>
/// <see cref="IQuoteBotCatchLog"/> over the app log (D-25). One line per caught send, with the reason code and nothing else: no
/// address, name, number or text (CWE-532), so the owner can see if catches spike without keeping what a visitor typed.
/// </summary>
internal sealed partial class QuoteBotCatchLog(ILogger<QuoteBotCatchLog> logger) : IQuoteBotCatchLog
{
    public void Caught(string reason) => LogCaught(logger, reason);

    [LoggerMessage(Level = LogLevel.Information, Message = "Quote form send caught by the bot guard: {Reason}")]
    private static partial void LogCaught(ILogger logger, string reason);
}

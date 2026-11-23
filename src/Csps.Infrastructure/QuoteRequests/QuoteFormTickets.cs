using System.Globalization;
using System.Security.Cryptography;
using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Microsoft.AspNetCore.DataProtection;

namespace Csps.Infrastructure.QuoteRequests;

/// <summary>
/// <see cref="IQuoteFormTickets"/> over a time-limited Data Protection protector (INQ-03, D-25). The ticket holds the issue time and is
/// signed and encrypted with the app's own keys, so the browser cannot make or change one. A ticket is good for the configured lifetime:
/// the protector refuses an old one by the system clock, and the age is checked again against the clock the caller passes.
/// </summary>
internal sealed class QuoteFormTickets : IQuoteFormTickets
{
    private const string Purpose = "Csps.QuoteTicket.v1";

    private readonly ITimeLimitedDataProtector _protector;
    private readonly QuoteRequestSettings _settings;

    public QuoteFormTickets(IDataProtectionProvider provider, QuoteRequestSettings settings)
    {
        ArgumentNullException.ThrowIfNull(provider);
        ArgumentNullException.ThrowIfNull(settings);
        _protector = provider.CreateProtector(Purpose).ToTimeLimitedDataProtector();
        _settings = settings;
    }

    public string Issue(DateTimeOffset now) =>
        _protector.Protect(now.UtcTicks.ToString(CultureInfo.InvariantCulture), _settings.TicketLifetime);

    public QuoteTicketReading Read(string? ticket, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(ticket))
        {
            return QuoteTicketReading.Expired;
        }

        string text;
        try
        {
            text = _protector.Unprotect(ticket);
        }
        catch (CryptographicException)
        {
            return QuoteTicketReading.Expired;
        }

        if (!long.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
            || ticks > DateTimeOffset.MaxValue.UtcTicks)
        {
            return QuoteTicketReading.Expired;
        }

        var age = now - new DateTimeOffset(ticks, TimeSpan.Zero);
        return age > _settings.TicketLifetime ? QuoteTicketReading.Expired : QuoteTicketReading.Valid(age);
    }
}

using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Passwords;

/// <summary>
/// The Pwned Passwords range check (AUTH-11, D-12). Only the first five characters of the SHA-1 of the NFC password
/// go to the fixed address below, with <c>Add-Padding</c>; the rest of the hash is compared here. The address is a
/// constant and is never read from settings or the client (CWE-918, T-04-59).
/// </summary>
/// <param name="http">The typed client; its resilience handler bounds the wait.</param>
/// <param name="logger">Receives a warning with the failure status only (T-04-58).</param>
internal sealed partial class HibpPwnedPasswords(HttpClient http, ILogger<HibpPwnedPasswords> logger) : IPwnedPasswords
{
    /// <summary>The range endpoint; the five-character prefix is appended.</summary>
    internal const string RangeUrl = "https://api.pwnedpasswords.com/range/";

    private const int PrefixLength = 5;
    private const string UserAgent = "CSPS-Password-Check";

    /// <inheritdoc />
    public async Task<BreachCheckResult> CheckAsync(string password, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(password);

        var (prefix, suffix) = Hash(password);
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(RangeUrl + prefix));
        request.Headers.TryAddWithoutValidation("Add-Padding", "true");
        request.Headers.UserAgent.ParseAdd(UserAgent);

        try
        {
            using var response = await http.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                LogUnavailableStatus(logger, (int)response.StatusCode);
                return BreachCheckResult.Unavailable;
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!HibpRangeParser.HasEntries(body))
            {
                LogUnavailable(logger, "unreadable answer");
                return BreachCheckResult.Unavailable;
            }

            return HibpRangeParser.Contains(body, suffix) ? BreachCheckResult.Breached : BreachCheckResult.NotBreached;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
#pragma warning disable CA1031 // Timeouts, open circuits and network errors all mean "no answer"; only the exception type is logged.
        catch (Exception exception)
#pragma warning restore CA1031
        {
            LogUnavailable(logger, exception.GetType().Name);
            return BreachCheckResult.Unavailable;
        }
    }

    [SuppressMessage("Security", "CA5350:Do Not Use Weak Cryptographic Algorithms", Justification = "The Pwned Passwords range protocol is defined over SHA-1; it is a lookup key, not a protection.")]
    private static (string Prefix, string Suffix) Hash(string password)
    {
        var bytes = Encoding.UTF8.GetBytes(PasswordPolicy.Normalize(password));
        var hex = Convert.ToHexString(SHA1.HashData(bytes)).ToUpper(CultureInfo.InvariantCulture);
        return (hex[..PrefixLength], hex[PrefixLength..]);
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "The breach check was unavailable (HTTP {Status}).")]
    private static partial void LogUnavailableStatus(ILogger logger, int status);

    [LoggerMessage(Level = LogLevel.Warning, Message = "The breach check was unavailable ({Reason}).")]
    private static partial void LogUnavailable(ILogger logger, string reason);
}

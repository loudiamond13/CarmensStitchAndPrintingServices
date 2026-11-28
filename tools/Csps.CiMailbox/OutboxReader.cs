using System.Text.RegularExpressions;
using Csps.Application.Email;
using Csps.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Csps.CiMailbox;

/// <summary>Reads queued mail from the outbox (14 D-36). CI only; never run against a real database.</summary>
public static partial class OutboxReader
{
    /// <summary>The Data Protection purpose of outbox content. A test fails when it drifts from the site's.</summary>
    public const string ProtectionPurpose = "Csps.EmailOutbox.v1";

    /// <summary>Returns the plain text of the newest open row for an address and kind, or null.</summary>
    /// <param name="db">The context.</param>
    /// <param name="protector">The outbox protector.</param>
    /// <param name="to">The recipient address.</param>
    /// <param name="kind">The kind of email.</param>
    /// <param name="ct">Cancels the work.</param>
    /// <returns>The text, or null when no open row matches.</returns>
    public static async Task<string?> ReadNewestAsync(CspsDbContext db, IDataProtector protector, string to, AuthEmailKind kind, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(protector);
        ArgumentException.ThrowIfNullOrWhiteSpace(to);

        // A closed row has its text cleared, so only an open row can match. SQL Server sorts a GUID by its last bytes, not by
        // time, so the newest row is found by CreatedAt.
        var protectedText = await db.EmailOutbox
            .AsNoTracking()
            .Where(message => message.ToAddress == to && message.Kind == kind && message.ProtectedText != null)
            .OrderByDescending(message => message.CreatedAt)
            .Select(message => message.ProtectedText)
            .FirstOrDefaultAsync(ct)
            .ConfigureAwait(false);

        return protectedText is null ? null : protector.Unprotect(protectedText);
    }

    /// <summary>Takes the code or token out of an email text.</summary>
    /// <param name="kind">The kind of email.</param>
    /// <param name="text">The plain text.</param>
    /// <returns>The value, or null when the text holds none.</returns>
    public static string? Extract(AuthEmailKind kind, string text)
    {
        ArgumentNullException.ThrowIfNull(text);

        return kind switch
        {
            AuthEmailKind.SignInCode => SingleValue(CodeLine().Matches(text)),
            AuthEmailKind.Invite => SingleValue(InviteLink().Matches(text)),
            _ => null,
        };
    }

    private static string? SingleValue(MatchCollection matches)
    {
        var values = matches.Select(match => match.Groups["value"].Value).Distinct(StringComparer.Ordinal).ToList();
        return values.Count == 1 ? Uri.UnescapeDataString(values[0]) : null;
    }

    // The code sits alone on its line, so a date or a time in the text never matches.
    [GeneratedRegex(@"^(?<value>\d{6})\r?$", RegexOptions.Multiline | RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 1000)]
    private static partial Regex CodeLine();

    // The invite button's fallback link carries the token only in the fragment (AppLinksOptions).
    [GeneratedRegex(@"/admin/accept-invite#token=(?<value>[^\s]+)", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 1000)]
    private static partial Regex InviteLink();
}

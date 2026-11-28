using Csps.Application.Email;
using Csps.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;

namespace Csps.CiMailbox;

/// <summary>Reads queued mail from the outbox (14 D-36). CI only.</summary>
public static class OutboxReader
{
    /// <summary>The Data Protection purpose of outbox content.</summary>
    public const string ProtectionPurpose = "";

    /// <summary>Returns the plain text of the newest open row for an address and kind, or null.</summary>
    /// <param name="db">The context.</param>
    /// <param name="protector">The outbox protector.</param>
    /// <param name="to">The recipient address.</param>
    /// <param name="kind">The kind of email.</param>
    /// <param name="ct">Cancels the work.</param>
    /// <returns>The text, or null when no open row matches.</returns>
    public static Task<string?> ReadNewestAsync(CspsDbContext db, IDataProtector protector, string to, AuthEmailKind kind, CancellationToken ct) =>
        throw new NotImplementedException();

    /// <summary>Takes the code or token out of an email text.</summary>
    /// <param name="kind">The kind of email.</param>
    /// <param name="text">The plain text.</param>
    /// <returns>The value, or null when the text holds none.</returns>
    public static string? Extract(AuthEmailKind kind, string text) => null;
}

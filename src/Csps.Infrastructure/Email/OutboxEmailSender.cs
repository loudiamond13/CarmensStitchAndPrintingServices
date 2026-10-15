using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Email;

/// <summary>
/// Queues auth mail as an outbox row on the request's context (AUTH-13). The row commits with the caller's unit of
/// work, and the subject and both bodies are stored Data-Protection-encrypted, so a code in a subject (D-08) is never
/// clear in the database.
/// </summary>
/// <param name="context">The request's scoped context.</param>
/// <param name="renderer">Renders the email.</param>
/// <param name="protection">Provides the outbox protector.</param>
/// <param name="time">The clock.</param>
internal sealed class OutboxEmailSender(CspsDbContext context, EmailRenderer renderer, IDataProtectionProvider protection, TimeProvider time) : IEmailOutbox
{
    /// <summary>The Data Protection purpose of outbox content.</summary>
    internal const string ProtectionPurpose = "Csps.EmailOutbox.v1";

    /// <inheritdoc />
    public async ValueTask EnqueueAsync(AuthEmail email, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(email);

        var rendered = await renderer.RenderAsync(email, cancellationToken).ConfigureAwait(false);
        var protector = protection.CreateProtector(ProtectionPurpose);
        var now = time.GetUtcNow();

        context.EmailOutbox.Add(EmailOutboxMessage.Queue(
            Guid.CreateVersion7(now),
            email.Kind,
            email.To,
            protector.Protect(rendered.Subject),
            protector.Protect(rendered.Text),
            protector.Protect(rendered.Html),
            now,
            email.NotAfter(now)));
    }

    /// <inheritdoc />
    public Task<int> CountRecentAsync(AuthEmailKind kind, string toAddress, DateTimeOffset since, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toAddress);

        var to = toAddress.Trim();
        return context.EmailOutbox.CountAsync(
            message => message.Kind == kind && message.ToAddress == to && message.CreatedAt >= since, cancellationToken);
    }
}

using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Auditing;

/// <summary>
/// Writes audit entries through EF Core (FND-10). The request facts are minimized by <see cref="AuditEntry.Create"/>
/// before the entry exists: only the /24 or /48 address prefix and the browser family are stored (D-24), never the raw
/// address or User-Agent. Neither raw value is logged here either.
/// </summary>
/// <param name="context">The scoped database context; <see cref="Record"/> only adds to it.</param>
/// <param name="contextFactory">Creates the short-lived context of <see cref="RecordIndependentlyAsync"/>.</param>
/// <param name="request">Facts about the current request (user, address, User-Agent, correlation id).</param>
/// <param name="time">The clock; entries are stamped in UTC.</param>
internal sealed class AuditTrail(
    CspsDbContext context,
    IDbContextFactory<CspsDbContext> contextFactory,
    IRequestContext request,
    TimeProvider time) : IAuditTrail
{
    /// <inheritdoc />
    public void Record(string action, string? targetType, string? targetId, string? detail) =>
        context.AuditLog.Add(Create(action, targetType, targetId, detail));

    /// <inheritdoc />
    public async ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken)
    {
        var entry = Create(action, targetType, targetId, detail);
        var own = await contextFactory.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (own.ConfigureAwait(false))
        {
            own.AuditLog.Add(entry);
            await own.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private AuditEntry Create(string action, string? targetType, string? targetId, string? detail) =>
        AuditEntry.Create(
            time.GetUtcNow(),
            request.UserId,
            action,
            targetType,
            targetId,
            request.RemoteIp,
            request.UserAgent,
            request.CorrelationId,
            detail);
}

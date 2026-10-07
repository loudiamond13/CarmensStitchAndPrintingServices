using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Auditing;

/// <summary>
/// Writes audit entries through EF Core (FND-10). The request facts are minimized by <see cref="AuditEntry.Create"/>
/// before the entry exists: only the /24 or /48 address prefix and the browser family are stored (D-24), never the raw
/// address or User-Agent. Neither raw value is logged here either.
/// </summary>
/// <param name="context">The scoped database context.</param>
/// <param name="request">Facts about the current request (user, address, User-Agent, correlation id).</param>
/// <param name="time">The clock; entries are stamped in UTC.</param>
internal sealed class AuditTrail(CspsDbContext context, IRequestContext request, TimeProvider time) : IAuditTrail
{
    /// <inheritdoc />
    public async ValueTask AppendAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken)
    {
        var entry = AuditEntry.Create(
            time.GetUtcNow(),
            request.UserId,
            action,
            targetType,
            targetId,
            request.RemoteIp,
            request.UserAgent,
            request.CorrelationId,
            detail);

        context.AuditLog.Add(entry);
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}

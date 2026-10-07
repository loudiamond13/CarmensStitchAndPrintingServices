using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Auditing;

/// <summary>RED placeholder: saves nothing yet.</summary>
internal sealed class AuditTrail(CspsDbContext context, IRequestContext request, TimeProvider time) : IAuditTrail
{
    private readonly CspsDbContext _context = context;
    private readonly IRequestContext _request = request;
    private readonly TimeProvider _time = time;

    public ValueTask AppendAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken)
    {
        _ = (_context, _request, _time);
        return ValueTask.CompletedTask;
    }
}

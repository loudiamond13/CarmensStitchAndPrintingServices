using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;

namespace Csps.Application.UnitTests.Auth;

/// <summary>One audit entry the handler recorded, and whether it went through the independent path.</summary>
internal sealed record AuditCall(string Action, string? TargetType, string? TargetId, string? Detail, bool Independent);

/// <summary>An email outbox that keeps what was queued.</summary>
internal sealed class RecordingOutbox : IEmailOutbox
{
    public List<AuthEmail> Emails { get; } = [];

    public ValueTask EnqueueAsync(AuthEmail email, CancellationToken cancellationToken)
    {
        Emails.Add(email);
        return ValueTask.CompletedTask;
    }

    public Task<int> CountRecentAsync(AuthEmailKind kind, string toAddress, DateTimeOffset since, CancellationToken cancellationToken) =>
        Task.FromResult(0);
}

/// <summary>An audit trail that keeps what was recorded.</summary>
internal sealed class RecordingAudit : IAuditTrail
{
    public List<AuditCall> Entries { get; } = [];

    public void Record(string action, string? targetType, string? targetId, string? detail) =>
        Entries.Add(new AuditCall(action, targetType, targetId, detail, Independent: false));

    public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken)
    {
        Entries.Add(new AuditCall(action, targetType, targetId, detail, Independent: true));
        return ValueTask.CompletedTask;
    }
}

/// <summary>Runs the work at once and counts commits, like a real unit of work without a database.</summary>
internal sealed class FakeUnitOfWork : IUnitOfWork
{
    public int Saves { get; private set; }

    /// <summary>Gets or sets whether a save fails the way the real unit of work does when another request changed the same row.</summary>
    public bool ConflictOnSave { get; set; }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        Saves++;
        if (ConflictOnSave)
        {
            throw new ConcurrencyConflictException(new InvalidOperationException("Another request changed the row."));
        }

        return Task.FromResult(1);
    }

    public Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken) =>
        work(cancellationToken);
}

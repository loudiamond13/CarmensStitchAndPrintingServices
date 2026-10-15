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

    /// <summary>How many emails of each kind the outbox reports as already queued in the window; absent means none.</summary>
    public Dictionary<AuthEmailKind, int> Recent { get; } = [];

    /// <summary>The window queries the handler made.</summary>
    public List<(AuthEmailKind Kind, string To, DateTimeOffset Since)> Counts { get; } = [];

    public ValueTask EnqueueAsync(AuthEmail email, CancellationToken cancellationToken)
    {
        Emails.Add(email);
        return ValueTask.CompletedTask;
    }

    public Task<int> CountRecentAsync(AuthEmailKind kind, string toAddress, DateTimeOffset since, CancellationToken cancellationToken)
    {
        Counts.Add((kind, toAddress, since));
        return Task.FromResult(Recent.GetValueOrDefault(kind));
    }
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
    private int _failuresLeft;

    public int Saves { get; private set; }

    /// <summary>Makes the next save fail the way the real unit of work does when another request changed the same row.</summary>
    public void FailFirstSaveWithConflict() => _failuresLeft = 1;

    /// <summary>Makes every save fail with that conflict.</summary>
    public void FailEverySaveWithConflict() => _failuresLeft = int.MaxValue;

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        Saves++;
        if (_failuresLeft > 0)
        {
            _failuresLeft--;
            throw new ConcurrencyConflictException(new InvalidOperationException("Another request changed the row."));
        }

        return Task.FromResult(1);
    }

    public Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken) =>
        work(cancellationToken);
}

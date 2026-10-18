using Csps.Application.Ports;

namespace Csps.Application.UnitTests.Users;

/// <summary>A session cache that records which users were evicted and what the unit of work had done by then.</summary>
internal sealed class EvictionProbe : ISessionCache
{
    private Func<(int Saves, int Commits)>? _snapshot;

    /// <summary>The users evicted, in order.</summary>
    public List<Guid> EvictedUsers { get; } = [];

    /// <summary>The saves the unit of work had made when the first eviction happened; -1 before any.</summary>
    public int SavesWhenEvicted { get; private set; } = -1;

    /// <summary>The commits the unit of work had made when the first eviction happened; -1 before any.</summary>
    public int CommitsWhenEvicted { get; private set; } = -1;

    /// <summary>Tells the probe how to read the unit of work's counters at eviction time.</summary>
    /// <param name="unit">The fake unit of work.</param>
    public void Watch(Auth.FakeUnitOfWork unit) => _snapshot = () => (unit.Saves, unit.Commits);

    public ValueTask<bool> IsActiveAsync(Guid sessionId, Guid userId, CancellationToken cancellationToken) => ValueTask.FromResult(true);

    public ValueTask EvictAsync(Guid sessionId, CancellationToken cancellationToken) => ValueTask.CompletedTask;

    public ValueTask EvictUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        if (EvictedUsers.Count == 0 && _snapshot is { } read)
        {
            (SavesWhenEvicted, CommitsWhenEvicted) = read();
        }

        EvictedUsers.Add(userId);
        return ValueTask.CompletedTask;
    }
}

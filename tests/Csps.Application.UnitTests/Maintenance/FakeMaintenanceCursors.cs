using Csps.Application.Ports;

namespace Csps.Application.UnitTests.Maintenance;

/// <summary>An in-memory place keeper for the job tests, with a record of every write.</summary>
internal sealed class FakeMaintenanceCursors : IMaintenanceCursors
{
    public Dictionary<string, string> Saved { get; } = new(StringComparer.Ordinal);

    public List<string> Writes { get; } = [];

    public Task<string?> GetAsync(string jobName, CancellationToken cancellationToken) =>
        Task.FromResult(Saved.TryGetValue(jobName, out var cursor) ? cursor : null);

    public Task SaveAsync(string jobName, string cursor, CancellationToken cancellationToken)
    {
        Saved[jobName] = cursor;
        Writes.Add($"save:{cursor}");
        return Task.CompletedTask;
    }

    public Task ClearAsync(string jobName, CancellationToken cancellationToken)
    {
        Saved.Remove(jobName);
        Writes.Add("clear");
        return Task.CompletedTask;
    }
}

using System.Collections.Concurrent;
using Csps.Domain.Analytics;

namespace Csps.Infrastructure.Analytics;

/// <summary>
/// Keeps the recent days' entries in process, so most requests need no read (ANL-05). One instance lives for the whole process. A day older than
/// the salt lifetime is dropped whenever a newer day is added, so the process never holds a salt the purge job has deleted.
/// </summary>
internal sealed class AnalyticsSaltCache
{
    private readonly ConcurrentDictionary<DateOnly, byte[]> _entries = new();

    /// <summary>Reads a cached salt.</summary>
    /// <param name="day">The business day.</param>
    /// <param name="salt">The salt, when found.</param>
    /// <returns>True when the day is cached.</returns>
    public bool TryGet(DateOnly day, out byte[] salt) => _entries.TryGetValue(day, out salt!);

    /// <summary>Caches a day's salt and forgets days older than the salt lifetime.</summary>
    /// <param name="day">The business day.</param>
    /// <param name="salt">The salt.</param>
    /// <returns>The salt that is cached for the day (an earlier one when two callers raced).</returns>
    public byte[] Set(DateOnly day, byte[] salt)
    {
        var kept = _entries.GetOrAdd(day, salt);
        var oldest = day.AddDays(-AnalyticsRetention.SaltDays);
        foreach (var key in _entries.Keys.Where(key => key < oldest))
        {
            _entries.TryRemove(key, out _);
        }

        return kept;
    }
}

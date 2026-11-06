using Csps.Application.Ports;

namespace Csps.Application.UnitTests.Maintenance;

/// <summary>An in-memory removal queue that follows the same lease rules as the database one, so the jobs can be tested without a database.</summary>
internal sealed class FakeImageDeletionQueue : IImageDeletionQueue
{
    private long _nextId = 1;

    public List<QueueRow> Rows { get; } = [];

    public List<(string PublicId, ImageDeletionReason Reason)> Queued { get; } = [];

    public int Claims { get; private set; }

    public QueueRow Add(string publicId, int attempts = 0, DateTimeOffset? due = null)
    {
        var row = new QueueRow { Id = _nextId++, PublicId = publicId, Attempts = attempts, NextAttemptAtUtc = due ?? DateTimeOffset.MinValue };
        Rows.Add(row);
        return row;
    }

    public void Enqueue(string publicId, ImageDeletionReason reason) => throw new NotSupportedException("The jobs queue on their own context.");

    public Task EnqueueNowAsync(string publicId, ImageDeletionReason reason, CancellationToken cancellationToken) =>
        throw new NotSupportedException("The jobs queue in bulk.");

    public Task EnqueueManyNowAsync(IReadOnlyCollection<string> publicIds, ImageDeletionReason reason, CancellationToken cancellationToken)
    {
        foreach (var publicId in publicIds)
        {
            Queued.Add((publicId, reason));
            Add(publicId);
        }

        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<QueuedRemoval>> ClaimDueAsync(Guid holder, DateTimeOffset now, TimeSpan lease, int max, CancellationToken cancellationToken)
    {
        Claims++;
        var due = Rows
            .Where(row => row.NextAttemptAtUtc <= now && (row.LeaseUntilUtc is null || row.LeaseUntilUtc < now))
            .OrderBy(row => row.NextAttemptAtUtc)
            .ThenBy(row => row.Id)
            .Take(max)
            .ToList();
        foreach (var row in due)
        {
            row.LeaseUntilUtc = now + lease;
            row.LeaseHolder = holder;
        }

        return Task.FromResult<IReadOnlyList<QueuedRemoval>>([.. due.Select(row => new QueuedRemoval(row.Id, row.PublicId, row.Attempts))]);
    }

    public Task CompleteAsync(long id, Guid holder, CancellationToken cancellationToken)
    {
        Rows.RemoveAll(row => row.Id == id && row.LeaseHolder == holder);
        return Task.CompletedTask;
    }

    public Task FailAsync(long id, Guid holder, string failureCode, DateTimeOffset now, CancellationToken cancellationToken)
    {
        foreach (var row in Rows.Where(row => row.Id == id && row.LeaseHolder == holder))
        {
            row.Attempts++;
            row.LastFailureCode = failureCode;
            row.NextAttemptAtUtc = now;
            row.LeaseUntilUtc = null;
            row.LeaseHolder = null;
        }

        return Task.CompletedTask;
    }

    public Task ReleaseAsync(IReadOnlyCollection<long> ids, Guid holder, CancellationToken cancellationToken)
    {
        foreach (var row in Rows.Where(row => ids.Contains(row.Id) && row.LeaseHolder == holder))
        {
            row.LeaseUntilUtc = null;
            row.LeaseHolder = null;
        }

        return Task.CompletedTask;
    }

    internal sealed class QueueRow
    {
        public long Id { get; init; }

        public string PublicId { get; init; } = string.Empty;

        public int Attempts { get; set; }

        public DateTimeOffset NextAttemptAtUtc { get; set; }

        public DateTimeOffset? LeaseUntilUtc { get; set; }

        public Guid? LeaseHolder { get; set; }

        public string? LastFailureCode { get; set; }
    }
}

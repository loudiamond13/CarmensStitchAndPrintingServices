using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.QuoteRequests;

/// <summary>
/// <see cref="IQuoteRequestStore"/> over EF: tracked rows, saved by the unit of work. The lock is the update of the standing
/// <c>quote-requests</c> row. A lost deadlock is a lost race and a timeout is busy, the same as the staff money lock.
/// </summary>
/// <param name="context">The request's database context.</param>
/// <param name="time">The clock.</param>
/// <param name="logger">The logger.</param>
/// <param name="wait">How long the lock may be waited for; only tests shorten it.</param>
internal sealed partial class QuoteRequestStore(CspsDbContext context, TimeProvider time, ILogger<QuoteRequestStore> logger, TimeSpan wait) : IQuoteRequestStore
{
    private const string EmailCollation = "Latin1_General_100_CI_AS";

    public QuoteRequestStore(CspsDbContext context, TimeProvider time, ILogger<QuoteRequestStore> logger)
        : this(context, time, logger, DatabaseLocks.DefaultWait)
    {
    }

    public Task<QuoteRequest?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        context.QuoteRequests
            .Include(request => request.Photos)
            .SingleOrDefaultAsync(request => request.Id == id, cancellationToken);

    public async Task<bool> LockForConversionAsync(Guid id, CancellationToken cancellationToken)
    {
        // The update takes the row's exclusive lock to the end of the transaction and matches only a request that is not Converted,
        // so a second order save of the same request waits here and then changes nothing. Any update moves the row version.
        try
        {
            var locked = await context.QuoteRequests
                .Where(request => request.Id == id && request.Status != QuoteRequestStatus.Converted)
                .ExecuteUpdateAsync(set => set.SetProperty(request => request.EditVersion, Guid.NewGuid()), cancellationToken)
                .ConfigureAwait(false);
            return locked == 1;
        }
        catch (Exception error) when (SqlErrors.Has(error, SqlErrors.Timeout, SqlErrors.DeadlockVictim))
        {
            // A wait for the row that ran out of time, or a deadlock victim, is a lost race like any other.
            context.ChangeTracker.Clear();
            throw new ConcurrencyConflictException(error);
        }
    }

    public Task<QuoteConversionState?> FindConversionAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult<QuoteConversionState?>(null);

    public void Add(QuoteRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        context.QuoteRequests.Add(request);
    }

    public void Remove(QuoteRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        context.QuoteRequests.Remove(request);
    }

    public async Task LockAsync(CancellationToken cancellationToken)
    {
        try
        {
            await DatabaseLocks.TakeAsync(
                    context,
                    DatabaseLocks.QuoteRequests,
                    time.GetUtcNow(),
                    wait,
                    "The quote request lock was not had in time.",
                    cancellationToken)
                .ConfigureAwait(false);
        }
        catch (DatabaseLockTimeoutException error) when (SqlErrors.Has(error, SqlErrors.DeadlockVictim))
        {
            // A lost deadlock is a lost race, as in a save: the unit of work marks an outer transaction ended, or the caller retries.
            context.ChangeTracker.Clear();
            throw new ConcurrencyConflictException(error);
        }
        catch (DatabaseLockTimeoutException error)
        {
            LogBusy(logger, error, DatabaseLocks.QuoteRequests, (int)Math.Ceiling(wait.TotalSeconds));
            throw new QuoteRequestsBusyException(error);
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "The lock {LockName} was not had within {WaitSeconds} seconds; the quote send answers busy.")]
    private static partial void LogBusy(ILogger logger, Exception exception, string lockName, int waitSeconds);

    public async Task<QuoteSenderRecent> CountRecentFromSenderAsync(
        string contactNumberE164, string? email, DateTimeOffset since, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(contactNumberE164);

        // The email is compared with an explicit case-insensitive collation, so the match never depends on the database default; no request matches on a missing email.
        var emailKey = string.IsNullOrEmpty(email) ? null : email;
        var times = await context.QuoteRequests
            .AsNoTracking()
            .Where(request => request.CreatedAtUtc > since
                && (request.ContactNumberE164 == contactNumberE164
                    || (emailKey != null && request.Email != null && EF.Functions.Collate(request.Email, EmailCollation) == emailKey)))
            .OrderBy(request => request.CreatedAtUtc)
            .Select(request => request.CreatedAtUtc)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return new QuoteSenderRecent(times);
    }

    public Task<QuoteProductLine?> FindShownLineAsync(string key, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(key);
        return context.ProductLines
            .AsNoTracking()
            .Where(line => line.IsActive && line.Key == key)
            .Select(line => new QuoteProductLine(line.Id, line.Title))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<QuotePhotoTarget?> FindForUploadAsync(Guid requestId, CancellationToken cancellationToken)
    {
        var row = await context.QuoteRequests
            .AsNoTracking()
            .Where(request => request.Id == requestId)
            .Select(request => new
            {
                request.Id,
                request.Status,
                request.UploadKeyHash,
                request.UploadKeyExpiresAtUtc,
                EmptySlots = request.Photos.Where(photo => photo.PublicId == null).Select(photo => photo.Slot).ToList(),
            })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
        return row is null ? null : new QuotePhotoTarget(row.Id, row.Status, row.UploadKeyHash, row.UploadKeyExpiresAtUtc, row.EmptySlots);
    }

    public async Task<bool> FillPhotoSlotAsync(Guid requestId, int slot, QuotePhotoStored stored, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(stored);
        var changed = await context.QuoteRequestPhotos
            .Where(photo => photo.QuoteRequestId == requestId
                && photo.Slot == slot
                && photo.PublicId == null
                && context.QuoteRequests.Any(request => request.Id == requestId && request.Status != QuoteRequestStatus.Spam))
            .ExecuteUpdateAsync(
                set => set
                    .SetProperty(photo => photo.PublicId, stored.PublicId)
                    .SetProperty(photo => photo.Width, stored.Width)
                    .SetProperty(photo => photo.Height, stored.Height)
                    .SetProperty(photo => photo.Bytes, stored.Bytes)
                    .SetProperty(photo => photo.Kind, stored.Kind)
                    .SetProperty(photo => photo.StoredAtUtc, stored.StoredAtUtc),
                cancellationToken)
            .ConfigureAwait(false);
        return changed == 1;
    }
}

using Csps.Application.Ports;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.QuoteRequests;

/// <summary><see cref="IQuoteRequestStore"/> over EF: tracked rows, saved by the unit of work.</summary>
internal sealed class QuoteRequestStore(CspsDbContext context, TimeProvider time) : IQuoteRequestStore
{
    private const string EmailCollation = "Latin1_General_100_CI_AS";

    public void Add(QuoteRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        context.QuoteRequests.Add(request);
    }

    public Task LockAsync(CancellationToken cancellationToken) =>
        DatabaseLocks.TakeAsync(
            context,
            DatabaseLocks.QuoteRequests,
            time.GetUtcNow(),
            DatabaseLocks.DefaultWait,
            "The quote request lock was not had in time.",
            cancellationToken);

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

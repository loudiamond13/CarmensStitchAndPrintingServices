using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Idempotency;

/// <summary>What <see cref="IdempotencyGate.BeginAsync"/> found for a key.</summary>
public enum IdempotencyLeaseState
{
    /// <summary>The key is new (or expired): run the request.</summary>
    Proceed,

    /// <summary>The same request already ran: send the stored answer.</summary>
    Replay,

    /// <summary>The key was used with a different body.</summary>
    Mismatch,

    /// <summary>The same key is being processed right now.</summary>
    Busy,
}

/// <summary>The stored answer of an earlier request.</summary>
/// <param name="StatusCode">The HTTP status.</param>
/// <param name="Body">The body; null when it was empty.</param>
/// <param name="ContentType">The Content-Type; null when there was no body.</param>
/// <param name="Location">The Location header, if any.</param>
public sealed record StoredResponse(int StatusCode, string? Body, string? ContentType, string? Location);

/// <summary>
/// An open transaction on the request's context behind the key's claim row. The business change, the stored answer and the
/// removal of the claim commit together through <see cref="StoreAndCommitAsync"/>; anything else rolls back and frees the claim,
/// also on dispose. A busy lease owns neither a transaction nor a claim.
/// </summary>
public sealed class IdempotencyLease : IAsyncDisposable
{
    private readonly CspsDbContext _context;
    private readonly IDbContextTransaction? _transaction;
    private readonly IdempotencyGate _gate;
    private readonly string? _claimName;
    private readonly Guid _holderId;
    private readonly Guid _key;
    private readonly Guid? _userId;
    private readonly string _route;
    private readonly byte[] _requestHash;
    private readonly DateTimeOffset _now;
    private bool _finished;

    internal IdempotencyLease(
        CspsDbContext context,
        IdempotencyGate gate,
        IDbContextTransaction? transaction,
        string? claimName,
        Guid holderId,
        IdempotencyLeaseState state,
        StoredResponse? replay,
        Guid key,
        Guid? userId,
        string route,
        byte[] requestHash,
        DateTimeOffset now)
    {
        _context = context;
        _gate = gate;
        _transaction = transaction;
        _claimName = claimName;
        _holderId = holderId;
        State = state;
        Replay = replay;
        _key = key;
        _userId = userId;
        _route = route;
        _requestHash = requestHash;
        _now = now;
    }

    /// <summary>Gets what the gate found.</summary>
    public IdempotencyLeaseState State { get; }

    /// <summary>Gets the stored answer when <see cref="State"/> is <see cref="IdempotencyLeaseState.Replay"/>.</summary>
    public StoredResponse? Replay { get; }

    /// <summary>Stores the answer next to the business change, removes the claim and commits all three.</summary>
    /// <param name="statusCode">The HTTP status.</param>
    /// <param name="body">The response body, or null when empty.</param>
    /// <param name="contentType">The response Content-Type, or null.</param>
    /// <param name="location">The Location header, or null.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the transaction is committed.</returns>
    public async Task StoreAndCommitAsync(int statusCode, string? body, string? contentType, string? location, CancellationToken cancellationToken)
    {
        var transaction = OpenTransaction("store an answer");

        _context.Add(IdempotencyRecord.Create(_key, _userId, _route, _requestHash, statusCode, body, contentType, location, _now));
        await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await DeleteClaimInTransactionAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        _finished = true;
    }

    /// <summary>Commits the business change without storing an answer, so the same key may run again.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the transaction is committed.</returns>
    public async Task CommitWithoutRecordAsync(CancellationToken cancellationToken)
    {
        var transaction = OpenTransaction("commit");

        await DeleteClaimInTransactionAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        _finished = true;
    }

    /// <summary>Rolls back the business change and releases the key, so the same key may run again.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the transaction is rolled back and the claim is released.</returns>
    public async Task RollbackAsync(CancellationToken cancellationToken)
    {
        if (_finished)
        {
            return;
        }

        _finished = true;
        await EndUnfinishedAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    /// <remarks>
    /// Never throws for a failed rollback or release, so it cannot replace the error that ended the request. The failure is
    /// logged, and the transaction is always disposed.
    /// </remarks>
    public async ValueTask DisposeAsync()
    {
        try
        {
            if (!_finished)
            {
                _finished = true;
                await EndUnfinishedAsync(CancellationToken.None).ConfigureAwait(false);
            }
        }
        catch (Exception exception) when (exception is InvalidOperationException || SqlErrors.IsDatabaseFailure(exception))
        {
            _gate.LogEndFailed(exception);
        }
        finally
        {
            if (_transaction is not null)
            {
                await _transaction.DisposeAsync().ConfigureAwait(false);
            }
        }
    }

    private IDbContextTransaction OpenTransaction(string action)
    {
        if (State != IdempotencyLeaseState.Proceed || _finished || _transaction is null)
        {
            throw new InvalidOperationException($"Only an open lease for a new key can {action}.");
        }

        return _transaction;
    }

    // The claim goes with the commit, so a duplicate never sees the key free before the answer is stored.
    private async Task DeleteClaimInTransactionAsync(CancellationToken cancellationToken)
    {
        var name = _claimName;
        var holder = _holderId;
        await _context.Set<DatabaseLock>()
            .Where(claim => claim.Name == name && claim.HolderId == holder)
            .ExecuteDeleteAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    // The claim is freed even if the rollback fails; a claim that cannot be freed ends with its lease.
    private async Task EndUnfinishedAsync(CancellationToken cancellationToken)
    {
        try
        {
            if (_transaction is not null)
            {
                await _transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
            }
        }
        finally
        {
            if (_claimName is not null)
            {
                await _gate.ReleaseClaimAsync(_claimName, _holderId).ConfigureAwait(false);
            }
        }
    }
}

/// <summary>
/// Looks a request key up behind a claim row (SEC-06, D-40, D-50). The claim is a row of DatabaseLocks committed on its own before
/// the request transaction, so a duplicate that arrives while the first runs finds it at once and is turned away without waiting.
/// The claim is removed in the same commit as the stored answer, or right after a rollback. The record's unique index stays the
/// last guard, so even a claim taken over after its lease can never store a second answer. After a crash the key answers
/// "in progress" until <see cref="ClaimLease"/> passes.
/// </summary>
/// <param name="context">The request's scoped context.</param>
/// <param name="contexts">Makes the short-lived contexts that write and free the claim outside the request transaction.</param>
/// <param name="logger">Receives a warning when the purge or a release fails; it never carries request data.</param>
public sealed partial class IdempotencyGate(CspsDbContext context, IDbContextFactory<CspsDbContext> contexts, ILogger<IdempotencyGate> logger)
{
    /// <summary>The most expired rows one request deletes from each table.</summary>
    public const int PurgeBatchSize = 100;

    /// <summary>How long a claim counts when its request never frees it, for example after the app stopped.</summary>
    public static readonly TimeSpan ClaimLease = TimeSpan.FromMinutes(2);

    private const int MaxClaimAttempts = 3;
    private const int DuplicateIndexKey = 2601;
    private const int DuplicateKey = 2627;

    /// <summary>The name of the claim row for a key: a hash, so no request data is stored (CWE-532).</summary>
    /// <param name="key">The client's request key.</param>
    /// <param name="route">The method and route pattern.</param>
    /// <param name="userId">The signed-in user, or null.</param>
    /// <returns>"idem:" and the SHA-256 in hex.</returns>
    public static string ClaimName(Guid key, string route, Guid? userId)
    {
        var text = string.Create(CultureInfo.InvariantCulture, $"{key:N}|{route}|{userId:N}");
        return "idem:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    }

    /// <summary>Claims the key, opens the transaction and reads any stored answer.</summary>
    /// <param name="key">The client's request key.</param>
    /// <param name="route">The method and route pattern.</param>
    /// <param name="userId">The signed-in user, or null.</param>
    /// <param name="requestHash">The keyed HMAC-SHA256 of the request target and body.</param>
    /// <param name="now">The current UTC time.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The lease. The caller disposes it.</returns>
    public async Task<IdempotencyLease> BeginAsync(
        Guid key, string route, Guid? userId, byte[] requestHash, DateTimeOffset now, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(route);
        ArgumentNullException.ThrowIfNull(requestHash);

        await PurgeExpiredAsync(now, cancellationToken).ConfigureAwait(false);

        var name = ClaimName(key, route, userId);
        var holder = Guid.NewGuid();
        if (!await TryClaimAsync(name, holder, now, cancellationToken).ConfigureAwait(false))
        {
            return new IdempotencyLease(context, this, null, null, holder, IdempotencyLeaseState.Busy, null, key, userId, route, requestHash, now);
        }

        IDbContextTransaction? transaction = null;
        try
        {
            transaction = await context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
            var (state, replay) = await InspectAsync(key, route, userId, requestHash, now, cancellationToken).ConfigureAwait(false);
            return new IdempotencyLease(context, this, transaction, name, holder, state, replay, key, userId, route, requestHash, now);
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync().ConfigureAwait(false);
            }

            await ReleaseClaimAsync(name, holder).ConfigureAwait(false);
            throw;
        }
    }

    // Writes the claim on its own connection and commits it at once. A taken name means the key is in progress, unless the
    // claim has outlived its lease: then exactly one caller takes it over.
    internal async Task<bool> TryClaimAsync(string name, Guid holderId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < MaxClaimAttempts; attempt++)
        {
            var claimContext = await contexts.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
            await using (claimContext.ConfigureAwait(false))
            {
                claimContext.Add(DatabaseLock.Claim(name, holderId, now, ClaimLease));
                try
                {
                    await claimContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                    return true;
                }
                catch (DbUpdateException error) when (error.InnerException is SqlException { Number: DuplicateIndexKey or DuplicateKey })
                {
                    // The failed row leaves with this context; the name is taken, so look at who holds it.
                }
            }

            var taken = await TakeOverIfStaleAsync(name, holderId, now, cancellationToken).ConfigureAwait(false);
            if (taken is { } outcome)
            {
                return outcome;
            }
        }

        return false;
    }

    // True: the stale claim is ours now. False: it is still in its lease, or another caller took it over first.
    // Null: the claim was freed in between, so the caller inserts again.
    private async Task<bool?> TakeOverIfStaleAsync(string name, Guid holderId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var claimContext = await contexts.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (claimContext.ConfigureAwait(false))
        {
            var current = await claimContext.Set<DatabaseLock>()
                .AsNoTracking()
                .Where(claim => claim.Name == name)
                .Select(claim => new { claim.ExpiresAtUtc })
                .FirstOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false);
            if (current is null)
            {
                return null;
            }

            if (current.ExpiresAtUtc is not { } expiresAt || expiresAt > now)
            {
                return false;
            }

            var renewedUntil = now + ClaimLease;
            try
            {
                var changed = await claimContext.Set<DatabaseLock>()
                    .Where(claim => claim.Name == name && claim.ExpiresAtUtc <= now)
                    .ExecuteUpdateAsync(
                        set => set
                            .SetProperty(claim => claim.TakenAtUtc, now)
                            .SetProperty(claim => claim.ExpiresAtUtc, renewedUntil)
                            .SetProperty(claim => claim.HolderId, holderId),
                        cancellationToken)
                    .ConfigureAwait(false);
                return changed == 1;
            }
            catch (Exception error) when (SqlErrors.Has(error, SqlErrors.DeadlockVictim))
            {
                // Another caller is taking the same claim over; the key reads as in progress and the client retries.
                return false;
            }
        }
    }

    // Frees a claim after a rollback or a failed start. Only the holder's own claim goes, so a claim taken over stays.
    internal async Task ReleaseClaimAsync(string name, Guid holderId)
    {
        try
        {
            var claimContext = await contexts.CreateDbContextAsync(CancellationToken.None).ConfigureAwait(false);
            await using (claimContext.ConfigureAwait(false))
            {
                await claimContext.Set<DatabaseLock>()
                    .Where(claim => claim.Name == name && claim.HolderId == holderId)
                    .ExecuteDeleteAsync(CancellationToken.None)
                    .ConfigureAwait(false);
            }
        }
        catch (Exception exception) when (SqlErrors.IsDatabaseFailure(exception))
        {
            LogReleaseFailed(logger, exception);
        }
    }

    // One short statement per table before the request's transaction, so its row locks end at once and never wait on a handler.
    // A failure is logged and ignored: the POST must not fail because old rows could not be removed.
    private async Task PurgeExpiredAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        try
        {
            await context.Set<IdempotencyRecord>()
                .Where(record => record.ExpiresAt <= now)
                .OrderBy(record => record.ExpiresAt)
                .Take(PurgeBatchSize)
                .ExecuteDeleteAsync(cancellationToken)
                .ConfigureAwait(false);
            await context.Set<DatabaseLock>()
                .Where(claim => claim.ExpiresAtUtc != null && claim.ExpiresAtUtc <= now)
                .OrderBy(claim => claim.ExpiresAtUtc)
                .Take(PurgeBatchSize)
                .ExecuteDeleteAsync(cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception exception) when (SqlErrors.IsDatabaseFailure(exception))
        {
            LogPurgeFailed(logger, exception);
        }
    }

    // A lease that could not roll back on dispose: the error is logged so it never replaces the request's own error.
    internal void LogEndFailed(Exception exception) => LogLeaseEndFailed(logger, exception);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Expired idempotency records could not be removed.")]
    private static partial void LogPurgeFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Warning, Message = "An idempotency claim could not be freed; it ends with its lease.")]
    private static partial void LogReleaseFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Warning, Message = "An idempotency lease could not be rolled back; its transaction is disposed.")]
    private static partial void LogLeaseEndFailed(ILogger logger, Exception exception);

    private async Task<(IdempotencyLeaseState State, StoredResponse? Replay)> InspectAsync(
        Guid key, string route, Guid? userId, byte[] requestHash, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var existing = await context.Set<IdempotencyRecord>()
            .AsNoTracking()
            .SingleOrDefaultAsync(record => record.Key == key && record.Route == route && record.UserId == userId, cancellationToken)
            .ConfigureAwait(false);
        if (existing is null)
        {
            return (IdempotencyLeaseState.Proceed, null);
        }

        // An expired key is forgotten and replaced.
        if (existing.ExpiresAt <= now)
        {
            var id = existing.Id;
            await context.Set<IdempotencyRecord>().Where(record => record.Id == id).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
            return (IdempotencyLeaseState.Proceed, null);
        }

        return CryptographicOperations.FixedTimeEquals(existing.RequestHash, requestHash)
            ? (IdempotencyLeaseState.Replay, new StoredResponse(existing.StatusCode, existing.ResponseBody, existing.ResponseContentType, existing.Location))
            : (IdempotencyLeaseState.Mismatch, null);
    }
}

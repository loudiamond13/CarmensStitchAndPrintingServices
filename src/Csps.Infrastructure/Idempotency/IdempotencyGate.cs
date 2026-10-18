using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Csps.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

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
/// An open transaction on the request's context that holds the key's lock. The business change and the stored answer
/// commit together through <see cref="StoreAndCommitAsync"/>; anything else rolls back, also on dispose.
/// </summary>
public sealed class IdempotencyLease : IAsyncDisposable
{
    private readonly CspsDbContext _context;
    private readonly IDbContextTransaction _transaction;
    private readonly Guid _key;
    private readonly Guid? _userId;
    private readonly string _route;
    private readonly byte[] _requestHash;
    private readonly DateTimeOffset _now;
    private bool _finished;

    internal IdempotencyLease(
        CspsDbContext context,
        IDbContextTransaction transaction,
        IdempotencyLeaseState state,
        StoredResponse? replay,
        Guid key,
        Guid? userId,
        string route,
        byte[] requestHash,
        DateTimeOffset now)
    {
        _context = context;
        _transaction = transaction;
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

    /// <summary>Stores the answer next to the business change and commits both.</summary>
    /// <param name="statusCode">The HTTP status.</param>
    /// <param name="body">The response body, or null when empty.</param>
    /// <param name="contentType">The response Content-Type, or null.</param>
    /// <param name="location">The Location header, or null.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the transaction is committed.</returns>
    public async Task StoreAndCommitAsync(int statusCode, string? body, string? contentType, string? location, CancellationToken cancellationToken)
    {
        if (State != IdempotencyLeaseState.Proceed || _finished)
        {
            throw new InvalidOperationException("Only an open lease for a new key can store an answer.");
        }

        _context.Add(IdempotencyRecord.Create(_key, _userId, _route, _requestHash, statusCode, body, contentType, location, _now));
        await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await _transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        _finished = true;
    }

    /// <summary>Commits the business change without storing an answer, so the same key may run again.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the transaction is committed.</returns>
    public async Task CommitWithoutRecordAsync(CancellationToken cancellationToken)
    {
        if (State != IdempotencyLeaseState.Proceed || _finished)
        {
            throw new InvalidOperationException("Only an open lease for a new key can commit.");
        }

        await _transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        _finished = true;
    }

    /// <summary>Rolls back the business change and releases the key, so the same key may run again.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the transaction is rolled back.</returns>
    public async Task RollbackAsync(CancellationToken cancellationToken)
    {
        if (_finished)
        {
            return;
        }

        _finished = true;
        await _transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        if (!_finished)
        {
            _finished = true;
            await _transaction.RollbackAsync(CancellationToken.None).ConfigureAwait(false);
        }

        await _transaction.DisposeAsync().ConfigureAwait(false);
    }
}

/// <summary>
/// Looks a request key up inside one transaction on the request's scoped context (SEC-06, D-40). It takes an
/// <c>sp_getapplock</c> on the key so a duplicate that arrives while the first is running is turned away, and the
/// record then commits with the business rows. <c>sp_getapplock</c> is the one reviewed raw-SQL call: every value
/// goes in as a parameter and the resource name is a hash (CWE-89).
/// </summary>
/// <param name="context">The request's scoped context.</param>
public sealed class IdempotencyGate(CspsDbContext context)
{
    private const int ResourceMaxLength = 255;

    /// <summary>Opens the transaction, takes the key's lock and reads any stored answer.</summary>
    /// <param name="key">The client's request key.</param>
    /// <param name="route">The method and route pattern.</param>
    /// <param name="userId">The signed-in user, or null.</param>
    /// <param name="requestHash">The SHA-256 of the request body.</param>
    /// <param name="now">The current UTC time.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The lease. The caller disposes it.</returns>
    public async Task<IdempotencyLease> BeginAsync(
        Guid key, string route, Guid? userId, byte[] requestHash, DateTimeOffset now, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(route);
        ArgumentNullException.ThrowIfNull(requestHash);

        var transaction = await context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var (state, replay) = await InspectAsync(key, route, userId, requestHash, now, cancellationToken).ConfigureAwait(false);
            return new IdempotencyLease(context, transaction, state, replay, key, userId, route, requestHash, now);
        }
        catch
        {
            await transaction.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    // The hash keeps the name short and free of the route text.
    private static string ResourceName(Guid key, string route, Guid? userId)
    {
        var text = string.Create(CultureInfo.InvariantCulture, $"{key:N}|{route}|{userId:N}");
        return "idem:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    }

    // sp_getapplock returns 0 or 1 when the lock is granted; a negative code means busy, cancelled or deadlocked.
    private async Task<bool> TryLockAsync(Guid key, string route, Guid? userId, CancellationToken cancellationToken)
    {
        var result = new SqlParameter("@result", SqlDbType.Int) { Direction = ParameterDirection.Output };
        var resource = new SqlParameter("@resource", SqlDbType.NVarChar, ResourceMaxLength) { Value = ResourceName(key, route, userId) };
        await context.Database.ExecuteSqlRawAsync(
            "EXEC @result = sp_getapplock @Resource = @resource, @LockMode = N'Exclusive', @LockOwner = N'Transaction', @LockTimeout = 0;",
            [result, resource],
            cancellationToken).ConfigureAwait(false);
        return result.Value is int code && code >= 0;
    }

    private async Task<(IdempotencyLeaseState State, StoredResponse? Replay)> InspectAsync(
        Guid key, string route, Guid? userId, byte[] requestHash, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (!await TryLockAsync(key, route, userId, cancellationToken).ConfigureAwait(false))
        {
            return (IdempotencyLeaseState.Busy, null);
        }

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

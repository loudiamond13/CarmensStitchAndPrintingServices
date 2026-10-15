namespace Csps.Domain.Identity;

/// <summary>
/// A pending sign-in that waits for an emailed code (AUTH-02, AUTH-03). Every rule is a function of the
/// <c>now</c> the caller passes in. Tickets and codes are kept only as hashes and compared in fixed time.
/// </summary>
public sealed class TwoFactorChallenge
{
    private readonly List<TwoFactorCode> _codes = [];

    // Used by EF Core (constructor binding) and by Start.
    private TwoFactorChallenge(
        Guid id,
        Guid userId,
        byte[] ticketHash,
        bool persistent,
        DateTimeOffset createdAt,
        DateTimeOffset expiresAt,
        TwoFactorChallengeStatus status,
        PasswordChangeReason? passwordChangeReason,
        DateTimeOffset? completedAt,
        DateTimeOffset? invalidatedAt,
        byte[] rowVersion)
    {
        Id = id;
        UserId = userId;
        TicketHash = ticketHash;
        Persistent = persistent;
        CreatedAt = createdAt;
        ExpiresAt = expiresAt;
        Status = status;
        PasswordChangeReason = passwordChangeReason;
        CompletedAt = completedAt;
        InvalidatedAt = invalidatedAt;
        RowVersion = rowVersion;
    }

    /// <summary>Primary key.</summary>
    public Guid Id { get; private set; }

    /// <summary>The account signing in.</summary>
    public Guid UserId { get; private set; }

    /// <summary>The 32-byte hash of the ticket held by the browser.</summary>
    public byte[] TicketHash { get; private set; }

    /// <summary>True when "Keep me signed in" was chosen on the first step (D-03).</summary>
    public bool Persistent { get; private set; }

    /// <summary>When the challenge started.</summary>
    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>When the challenge stops accepting anything.</summary>
    public DateTimeOffset ExpiresAt { get; private set; }

    /// <summary>Where the challenge stands.</summary>
    public TwoFactorChallengeStatus Status { get; private set; }

    /// <summary>Why a new password is needed; null unless <see cref="Status"/> is AwaitingNewPassword.</summary>
    public PasswordChangeReason? PasswordChangeReason { get; private set; }

    /// <summary>When the sign-in finished; null until then.</summary>
    public DateTimeOffset? CompletedAt { get; private set; }

    /// <summary>When the challenge was cancelled; null unless it was.</summary>
    public DateTimeOffset? InvalidatedAt { get; private set; }

    /// <summary>The codes issued so far, oldest first.</summary>
    public IReadOnlyList<TwoFactorCode> Codes => _codes;

    /// <summary>Optimistic-concurrency token maintained by the database (409 on conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>Starts a pending sign-in.</summary>
    /// <param name="userId">The account.</param>
    /// <param name="ticketHash">SHA-256 of the ticket given to the browser.</param>
    /// <param name="persistent">Whether "Keep me signed in" was chosen.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="settings">The limits.</param>
    /// <returns>A new, unsaved challenge.</returns>
    /// <exception cref="ArgumentException"><paramref name="ticketHash"/> is not 32 bytes.</exception>
    public static TwoFactorChallenge Start(
        Guid userId, ReadOnlySpan<byte> ticketHash, bool persistent, DateTimeOffset now, TwoFactorSettings settings)
    {
        RequireHashLength(ticketHash, nameof(ticketHash));
        return new TwoFactorChallenge(
            Guid.CreateVersion7(now),
            userId,
            ticketHash.ToArray(),
            persistent,
            now,
            now + settings.ChallengeLifetime,
            TwoFactorChallengeStatus.Pending,
            null,
            null,
            null,
            []);
    }

    /// <summary>Issues a new code. Only the newest code works afterwards.</summary>
    /// <param name="codeMac">The 32-byte MAC of the code.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="settings">The limits.</param>
    /// <returns>The new code.</returns>
    /// <exception cref="ArgumentException"><paramref name="codeMac"/> is not 32 bytes.</exception>
    /// <exception cref="InvalidOperationException">The challenge is closed.</exception>
    public TwoFactorCode IssueCode(ReadOnlySpan<byte> codeMac, DateTimeOffset now, TwoFactorSettings settings)
    {
        RequireHashLength(codeMac, nameof(codeMac));
        if (!IsOpen(now))
        {
            throw new InvalidOperationException("The challenge is closed.");
        }

        ActiveCode()?.Supersede(now);
        var code = TwoFactorCode.Issue(Id, codeMac, now, settings.CodeLifetime);
        _codes.Add(code);
        return code;
    }

    /// <summary>Checks a typed code against the newest code, in fixed time.</summary>
    /// <param name="codeMac">The 32-byte MAC of the typed code.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="settings">The limits.</param>
    /// <returns>The decision and the tries left.</returns>
    public TwoFactorVerifyResult Verify(ReadOnlySpan<byte> codeMac, DateTimeOffset now, TwoFactorSettings settings)
    {
        var active = ActiveCode();
        if (!IsOpen(now) || active is null || active.ConsumedAt is not null)
        {
            return new TwoFactorVerifyResult(TwoFactorVerifyOutcome.ChallengeClosed, 0);
        }

        if (now >= active.ExpiresAt)
        {
            return new TwoFactorVerifyResult(TwoFactorVerifyOutcome.CodeExpired, 0);
        }

        if (active.FailedAttempts >= settings.MaxAttemptsPerCode)
        {
            return new TwoFactorVerifyResult(TwoFactorVerifyOutcome.Exhausted, 0);
        }

        if (TokenHash.Equal(active.CodeMac, codeMac))
        {
            active.Consume(now);
            return new TwoFactorVerifyResult(
                TwoFactorVerifyOutcome.Ok, settings.MaxAttemptsPerCode - active.FailedAttempts);
        }

        active.RecordFailure();
        var remaining = settings.MaxAttemptsPerCode - active.FailedAttempts;
        return remaining <= 0
            ? new TwoFactorVerifyResult(TwoFactorVerifyOutcome.Exhausted, 0)
            : new TwoFactorVerifyResult(TwoFactorVerifyOutcome.Wrong, remaining);
    }

    /// <summary>Sums the wrong tries on codes issued at or after <paramref name="since"/>.</summary>
    /// <param name="since">The start of the rolling window.</param>
    /// <returns>The number of wrong tries.</returns>
    public int FailedAttemptsSince(DateTimeOffset since) =>
        _codes.Where(c => c.IssuedAt >= since).Sum(c => c.FailedAttempts);

    /// <summary>Cancels a challenge that is still waiting; a finished or cancelled one is left as it is.</summary>
    /// <param name="now">The current instant.</param>
    public void Invalidate(DateTimeOffset now)
    {
        if (Status is TwoFactorChallengeStatus.Pending or TwoFactorChallengeStatus.AwaitingNewPassword)
        {
            Status = TwoFactorChallengeStatus.Invalidated;
            InvalidatedAt = now;
        }
    }

    private static void RequireHashLength(ReadOnlySpan<byte> value, string name)
    {
        if (value.Length != TokenHash.HashLength)
        {
            throw new ArgumentException("The value must be a 32-byte hash.", name);
        }
    }

    private TwoFactorCode? ActiveCode() => _codes.LastOrDefault(c => c.SupersededAt is null);

    private bool IsOpen(DateTimeOffset now) => Status == TwoFactorChallengeStatus.Pending && now < ExpiresAt;
}

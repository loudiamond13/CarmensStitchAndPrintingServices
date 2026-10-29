namespace Csps.Application.Common;

/// <summary>
/// Thrown by the unit of work when a save found that another request changed the same row first, or lost a deadlock. The unit of
/// work has already dropped its tracked state, so a handler may load the data again and decide afresh, unless
/// <see cref="OuterTransactionEnded"/> says the transaction around the attempt is gone.
/// </summary>
public sealed class ConcurrencyConflictException : Exception
{
    /// <summary>Creates a conflict whose surrounding transaction, if any, is still open.</summary>
    /// <param name="innerException">The storage exception that reported the conflict.</param>
    public ConcurrencyConflictException(Exception innerException)
        : this(innerException, outerTransactionEnded: false)
    {
    }

    /// <summary>Creates a conflict and says whether the transaction around the attempt has ended.</summary>
    /// <param name="innerException">The storage exception that reported the conflict.</param>
    /// <param name="outerTransactionEnded">True when the server rolled back the outer transaction (a deadlock victim), so nothing more can be written in it.</param>
    public ConcurrencyConflictException(Exception innerException, bool outerTransactionEnded)
        : base("Another request changed the same data first.", innerException) =>
        OuterTransactionEnded = outerTransactionEnded;

    /// <summary>
    /// Gets a value indicating whether the outer transaction was rolled back by the server. A retry inside it would fail, so the
    /// caller answers the busy error at once.
    /// </summary>
    public bool OuterTransactionEnded { get; }
}

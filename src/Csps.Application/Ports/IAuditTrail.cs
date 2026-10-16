namespace Csps.Application.Ports;

/// <summary>
/// Appends one entry to the append-only audit log (FND-10, PRD section 11.4). The time, the signed-in user, the
/// minimized client address and browser family and the correlation id come from the current request; callers give
/// only what happened. Entries can never be changed or removed afterwards: the database rejects UPDATE, DELETE and
/// TRUNCATE (D-25, D-32).
/// </summary>
/// <remarks>
/// Never pass personal data or secrets: no e-mail addresses, names, phone numbers, passwords, codes or tokens.
/// People are referenced only by user id. The action codes are in <c>AuditActions</c> (AUDIT-01).
/// </remarks>
public interface IAuditTrail
{
    /// <summary>
    /// Adds one audit entry to the caller's unit of work. Nothing is saved here: <see cref="IUnitOfWork.SaveChangesAsync"/>
    /// commits it with the business change, so an entry never outlives a change that rolled back. Use it for events
    /// that belong to the change (sign-in success, reset completed).
    /// </summary>
    /// <param name="action">A dotted lowercase code such as <c>auth.sign-in-failed</c>; at most 64 characters.</param>
    /// <param name="targetType">The kind of thing acted on, for example <c>Order</c>, or null.</param>
    /// <param name="targetId">The id of the thing acted on, or null.</param>
    /// <param name="detail">An optional short plain-text note (at most 400 characters), or null.</param>
    void Record(string action, string? targetType, string? targetId, string? detail);

    /// <summary>
    /// Writes one audit entry through its own short-lived database context and saves it at once, so it survives a
    /// rollback of the caller's change and never saves the caller's tracked changes. Use it for failures that must
    /// persist (sign-in failed, code failed, reuse detected).
    /// </summary>
    /// <param name="action">A dotted lowercase code such as <c>auth.sign-in-failed</c>; at most 64 characters.</param>
    /// <param name="targetType">The kind of thing acted on, or null.</param>
    /// <param name="targetId">The id of the thing acted on, or null.</param>
    /// <param name="detail">An optional short plain-text note (at most 400 characters), or null.</param>
    /// <param name="cancellationToken">Cancels the save.</param>
    /// <returns>A task that completes when the entry is stored.</returns>
    ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken);
}

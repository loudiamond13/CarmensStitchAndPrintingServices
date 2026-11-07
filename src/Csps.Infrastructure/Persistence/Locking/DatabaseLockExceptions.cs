namespace Csps.Infrastructure.Persistence.Locking;

/// <summary>
/// A lock wait that ran out of time or was chosen as a deadlock victim. The message is the caller's own text; the SQL Server error
/// is the inner exception. Callers map this type, never its message.
/// </summary>
/// <param name="message">The caller's message.</param>
/// <param name="inner">The SQL Server error.</param>
internal sealed class DatabaseLockTimeoutException(string message, Exception inner) : InvalidOperationException(message, inner);

/// <summary>A standing lock row that does not exist, which means a migration is missing. This is a setup fault, never "busy".</summary>
/// <param name="name">The lock name.</param>
internal sealed class DatabaseLockMissingException(string name)
    : InvalidOperationException($"The standing lock row '{name}' is missing. Apply the database migrations.");

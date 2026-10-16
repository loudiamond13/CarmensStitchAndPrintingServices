namespace Csps.Application.Common;

/// <summary>
/// Thrown by the unit of work when a save found that another request changed the same row first. The unit of work
/// has already dropped its tracked state, so a handler may load the data again and decide afresh.
/// </summary>
/// <param name="innerException">The storage exception that reported the conflict.</param>
public sealed class ConcurrencyConflictException(Exception innerException)
    : Exception("Another request changed the same data first.", innerException);

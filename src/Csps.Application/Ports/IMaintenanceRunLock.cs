namespace Csps.Application.Ports;

/// <summary>
/// The lease that lets one maintenance run work at a time (JOB-01, T-09-17). It lives in the database, so it holds across app
/// instances and ends on its own after a crash.
/// </summary>
public interface IMaintenanceRunLock
{
    /// <summary>Tries to take the lease. A lease past its expiry counts as free.</summary>
    /// <param name="holder">Who asks; only this holder can release it.</param>
    /// <param name="now">The current UTC time.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>True when the lease is now held; false when another run holds it.</returns>
    Task<bool> TryTakeAsync(Guid holder, DateTimeOffset now, CancellationToken cancellationToken);

    /// <summary>Gives the lease back. Does nothing when another holder has it or it is gone.</summary>
    /// <param name="holder">Who took it.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the lease is free.</returns>
    Task ReleaseAsync(Guid holder, CancellationToken cancellationToken);
}

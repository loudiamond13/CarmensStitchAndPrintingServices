using Csps.Application.Staff;

namespace Csps.Application.Ports;

/// <summary>Read-only staff lookups for the payer fields (CEXP-05, D-32). Application never sees Identity.</summary>
public interface IStaffDirectory
{
    /// <summary>Lists the people who can be named as the payer, sorted by first name, last name, then id.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>Ids and names only.</returns>
    Task<IReadOnlyList<StaffMember>> ListActiveStaffAsync(CancellationToken cancellationToken);

    /// <summary>Reads one person's role and account flags.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The state, or null when no such account exists.</returns>
    Task<StaffState?> GetStaffStateAsync(Guid id, CancellationToken cancellationToken);
}

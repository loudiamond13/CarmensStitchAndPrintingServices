using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Staff;

/// <summary>Use case: either role reads who can be named as the payer (CEXP-05, D-32). Names and ids only.</summary>
public sealed class ListStaffHandler(IStaffDirectory directory)
{
    /// <summary>Lists the people who can pay.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The people, sorted by first name, last name, then id.</returns>
    public async Task<Result<IReadOnlyList<StaffMember>>> HandleAsync(CancellationToken cancellationToken)
    {
        var staff = await directory.ListActiveStaffAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(staff);
    }
}

using Csps.Application.Money;

namespace Csps.Application.Ports;

/// <summary>Untracked reads of staff money on hand (MONEY-01). Every figure is summed from the records on each read; nothing is stored or cached.</summary>
public interface IStaffMoneyReader
{
    /// <summary>Reads the six sums behind each asked person's money on hand.</summary>
    /// <param name="userIds">The people to read.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>One entry for each asked person who exists and is not the legacy holder; a person with no money rows has zero in every sum.</returns>
    Task<IReadOnlyList<StaffMoneySums>> GetSumsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken);
}

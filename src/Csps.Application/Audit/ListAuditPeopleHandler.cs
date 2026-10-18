using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Audit;

/// <summary>Use case: a Manager asks who the audit filters can offer (AUDIT-02, D-11, D-26): everyone ever recorded, former staff last.</summary>
public sealed class ListAuditPeopleHandler(IAuditLogReader reader)
{
    /// <summary>Lists the people for the Done by and Done to filters.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Current staff by name, then former staff by name.</returns>
    public async Task<Result<IReadOnlyList<AuditPerson>>> HandleAsync(CancellationToken cancellationToken)
    {
        var people = await reader.ListPeopleAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(people);
    }
}

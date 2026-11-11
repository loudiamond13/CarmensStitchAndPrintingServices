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

    /// <summary>
    /// Lists every Admin and Manager account except the legacy holder, with its account flags, in one untracked statement. There is no
    /// set-up or lock filter: that is not the recipient rule (D-56). It carries no figure.
    /// </summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The people sorted by first name, last name, then id.</returns>
    Task<IReadOnlyList<StaffPerson>> ListStaffPeopleAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Reads one page of a person's ledger, newest first, with the details each row names. The page, the sum of the newer rows, the
    /// count and the balance are read together so they agree (D-105). Nothing is stored or cached.
    /// </summary>
    /// <param name="userId">The person whose ledger is read.</param>
    /// <param name="page">The page number, from 1.</param>
    /// <param name="pageSize">The rows per page.</param>
    /// <param name="includeDeleted">True to show the person's deleted transfers too, each marked deleted and counting toward nothing.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The page, the total, the sum of the newer rows and the balance.</returns>
    Task<LedgerPage> GetLedgerPageAsync(Guid userId, int page, int pageSize, bool includeDeleted, CancellationToken cancellationToken);

    /// <summary>
    /// Lists staff money transfers newest first: by transfer date, then recorded time, then id. Each carries the people on it by name
    /// (a deleted person marked former staff), who recorded it and, when deleted, who deleted it. It never carries a balance.
    /// </summary>
    /// <param name="involving">Only transfers this person sent or received; null for every transfer.</param>
    /// <param name="includeDeleted">True to add deleted transfers.</param>
    /// <param name="page">The page number, from 1.</param>
    /// <param name="pageSize">The rows per page.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The page, with the total that matches across all pages.</returns>
    Task<MoneyTransferListResponse> ListTransfersAsync(Guid? involving, bool includeDeleted, int page, int pageSize, CancellationToken cancellationToken);
}

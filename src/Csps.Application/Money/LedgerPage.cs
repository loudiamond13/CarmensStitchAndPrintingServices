namespace Csps.Application.Money;

/// <summary>
/// One page of a person's ledger with the three figures the running balance needs, all read together (D-105).
/// </summary>
/// <param name="Rows">The rows of the page, newest first, each with its details.</param>
/// <param name="Total">How many rows the ledger has across all pages.</param>
/// <param name="NewerSum">The sum of the signed amounts of the rows newer than the page; 0.00 on the first page.</param>
/// <param name="Balance">The person's money on hand now.</param>
public sealed record LedgerPage(IReadOnlyList<LedgerRowView> Rows, int Total, decimal NewerSum, decimal Balance);

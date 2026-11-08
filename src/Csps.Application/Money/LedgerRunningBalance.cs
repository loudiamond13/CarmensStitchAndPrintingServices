namespace Csps.Application.Money;

/// <summary>The running balance after each ledger row, like a bank statement (D-41). Pure: the reader only fetches.</summary>
public static class LedgerRunningBalance
{
    /// <summary>Walks down a page of rows, newest first.</summary>
    /// <param name="rows">The rows of one page, newest first.</param>
    /// <param name="balanceAfterFirst">The balance after the newest row of the page: the current balance minus the rows newer than the page.</param>
    /// <returns>One entry for each row; null for a deleted row, which counts toward no balance.</returns>
    public static IReadOnlyList<decimal?> Apply(IReadOnlyList<LedgerRowView> rows, decimal balanceAfterFirst)
    {
        ArgumentNullException.ThrowIfNull(rows);

        var balances = new decimal?[rows.Count];
        var running = balanceAfterFirst;
        for (var index = 0; index < rows.Count; index++)
        {
            if (rows[index].IsDeleted)
            {
                continue;
            }

            balances[index] = running;
            running -= rows[index].SignedAmount;
        }

        return balances;
    }
}

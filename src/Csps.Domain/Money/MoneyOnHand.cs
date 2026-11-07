namespace Csps.Domain.Money;

/// <summary>The money-on-hand rule (MONEY-01).</summary>
public static class MoneyOnHand
{
    /// <summary>Works out the money a person holds. It may be below zero when they are owed money (D-15, D-16).</summary>
    /// <param name="received">Order payments they received.</param>
    /// <param name="transfersIn">Transfers sent to them.</param>
    /// <param name="transfersOut">Transfers they sent.</param>
    /// <param name="expensesPaid">Expenses they paid.</param>
    /// <param name="refundsHandedBack">Refunds they handed back.</param>
    /// <returns>The balance.</returns>
    public static decimal Of(decimal received, decimal transfersIn, decimal transfersOut, decimal expensesPaid, decimal refundsHandedBack) =>
        received + transfersIn - transfersOut - expensesPaid - refundsHandedBack;
}

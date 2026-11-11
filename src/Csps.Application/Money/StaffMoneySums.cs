using Csps.Domain.Money;

namespace Csps.Application.Money;

/// <summary>The six sums that make one person's money on hand, as the read port returns them.</summary>
/// <param name="UserId">The person.</param>
/// <param name="Name">Their display name, first then last.</param>
/// <param name="Received">Order payments they received.</param>
/// <param name="TransfersIn">Transfers sent to them that are not deleted.</param>
/// <param name="TransfersOut">Transfers they sent that are not deleted.</param>
/// <param name="OrderExpensesPaid">Order expenses they paid.</param>
/// <param name="CompanyExpensesPaid">Company expenses they paid.</param>
/// <param name="RefundsHandedBack">Refunds they handed back.</param>
public sealed record StaffMoneySums(
    Guid UserId,
    string Name,
    decimal Received,
    decimal TransfersIn,
    decimal TransfersOut,
    decimal OrderExpensesPaid,
    decimal CompanyExpensesPaid,
    decimal RefundsHandedBack)
{
    /// <summary>Works out the money on hand through the one domain formula. It may be below zero (D-15, D-16).</summary>
    /// <returns>The balance.</returns>
    public decimal Balance() =>
        MoneyOnHand.Of(Received, TransfersIn, TransfersOut, OrderExpensesPaid + CompanyExpensesPaid, RefundsHandedBack);

    /// <summary>Finds one person's balance in a list of sums.</summary>
    /// <param name="sums">The sums the read port returned.</param>
    /// <param name="userId">The person.</param>
    /// <returns>Their balance, or 0.00 when the list has no row for them.</returns>
    public static decimal BalanceOf(IReadOnlyList<StaffMoneySums> sums, Guid userId)
    {
        ArgumentNullException.ThrowIfNull(sums);
        return sums.FirstOrDefault(row => row.UserId == userId)?.Balance() ?? 0m;
    }
}

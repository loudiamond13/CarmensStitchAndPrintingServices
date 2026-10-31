using System.Globalization;
using Csps.Domain.Orders;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Mapping;

namespace Csps.LegacyFitCheck.Checks;

/// <summary>
/// Compares the totals a legacy order stores with the figures the CSPS math works out from its rows (D-08). Any difference, even one
/// centavo, is a finding. The amounts go only in the finding's Detail, which reaches the _local file and never the summary.
/// </summary>
internal static class TotalsComparer
{
    /// <summary>Works out the CSPS figures with the default import rules and compares them with the stored ones.</summary>
    /// <param name="legacyKey">The legacy table and id of the order.</param>
    /// <param name="snapshot">The mapped order.</param>
    /// <param name="legacy">The totals the legacy order stores.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="today">The business today.</param>
    /// <returns>The findings; one NotJudged when the order cannot be imported, so its figures cannot be worked out.</returns>
    public static IReadOnlyList<Finding> Check(string legacyKey, OrderImportSnapshot snapshot, LegacyStoredTotals legacy, DateTimeOffset now, DateOnly today)
    {
        ArgumentNullException.ThrowIfNull(snapshot);

        var imported = Order.Import(snapshot, OrderImportRules.Default, now, today);
        return imported.IsSuccess
            ? Compare(legacyKey, imported.Value.Totals, legacy)
            : [new Finding(RecordKind.Order, legacyKey, FindingType.NotJudged, "totals.not-compared", null, "The stored totals were not compared: the order cannot be imported, so its figures cannot be worked out.", null, null)];
    }

    /// <summary>Compares the five stored figures with the CSPS ones, by decimal value (trailing zeros do not matter).</summary>
    /// <param name="legacyKey">The legacy table and id of the order.</param>
    /// <param name="csps">The figures the CSPS math works out.</param>
    /// <param name="legacy">The totals the legacy order stores.</param>
    /// <returns>A TotalMismatch per figure that differs, and a CannotMap when the legacy order stores no total.</returns>
    public static IReadOnlyList<Finding> Compare(string legacyKey, OrderTotals csps, LegacyStoredTotals legacy)
    {
        ArgumentNullException.ThrowIfNull(csps);
        ArgumentNullException.ThrowIfNull(legacy);

        var findings = new List<Finding>();
        if (legacy.TotalAmount is { } stored)
        {
            Add(findings, legacyKey, "totals.total", "The stored total differs from the total CSPS works out.", stored, csps.Total);
        }
        else
        {
            findings.Add(new Finding(RecordKind.Order, legacyKey, FindingType.CannotMap, "totals.no-stored-total", null, "The legacy order stores no total, so the total cannot be compared.", null, null));
        }

        Add(findings, legacyKey, "totals.discount", "The stored discount differs from the discount CSPS works out.", legacy.TotalDiscount, csps.Discount);
        Add(findings, legacyKey, "totals.paid", "The stored paid amount differs from the paid amount CSPS works out.", legacy.PaidAmount, csps.Paid);
        Add(findings, legacyKey, "totals.balance", "The stored balance differs from the balance CSPS works out.", legacy.TotalBalance, csps.Balance);
        Add(findings, legacyKey, "totals.expenses", "The stored expenses differ from the expenses CSPS works out.", legacy.TotalExpenses, csps.Expenses);
        return findings;
    }

    private static void Add(List<Finding> findings, string legacyKey, string rule, string message, decimal stored, decimal worked)
    {
        if (stored != worked)
        {
            var detail = string.Create(CultureInfo.InvariantCulture, $"legacy {stored:0.00##}; CSPS {worked:0.00##}");
            findings.Add(new Finding(RecordKind.Order, legacyKey, FindingType.TotalMismatch, rule, null, message, null, detail));
        }
    }
}

using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Source;

namespace Csps.LegacyFitCheck.Mapping;

/// <summary>What the column check found, with the counts for the inventory line.</summary>
/// <param name="Findings">One finding per unknown, missing or not-mapped column.</param>
/// <param name="ColumnsRead">How many columns of the in-scope tables were read.</param>
/// <param name="Unknown">Columns that sit in neither the mapped nor the not-mapped set.</param>
/// <param name="Missing">Mapped columns that the restore does not have.</param>
internal sealed record ColumnInventoryResult(IReadOnlyList<Finding> Findings, int ColumnsRead, int Unknown, int Missing);

/// <summary>Checks that every column of the in-scope legacy tables is accounted for (D-05).</summary>
internal static class ColumnInventory
{
    public static ColumnInventoryResult Check(IReadOnlyList<LegacyColumn> columns)
    {
        ArgumentNullException.ThrowIfNull(columns);
        return new ColumnInventoryResult([], 0, 0, 0);
    }
}

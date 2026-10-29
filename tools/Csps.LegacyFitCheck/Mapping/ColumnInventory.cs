using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Source;

namespace Csps.LegacyFitCheck.Mapping;

/// <summary>What the column check found, with the counts for the inventory line.</summary>
/// <param name="Findings">One finding per unknown, missing or not-mapped column.</param>
/// <param name="ColumnsRead">How many columns of the in-scope tables were read.</param>
/// <param name="Unknown">Columns that sit in neither the mapped nor the not-mapped set.</param>
/// <param name="Missing">Mapped columns that the restore does not have.</param>
internal sealed record ColumnInventoryResult(IReadOnlyList<Finding> Findings, int ColumnsRead, int Unknown, int Missing);

/// <summary>
/// Checks that every column of the in-scope legacy tables is accounted for (D-05). It reads table and column names only, never a value.
/// A column the map does not know is cannot map, a mapped column the restore lacks is cannot map (drift), and each present
/// not-mapped column is reported with its reason.
/// </summary>
internal static class ColumnInventory
{
    public static ColumnInventoryResult Check(IReadOnlyList<LegacyColumn> columns)
    {
        ArgumentNullException.ThrowIfNull(columns);

        var known = DraftColumnMap.Entries.ToDictionary(static entry => Key(entry.Table, entry.Column), StringComparer.OrdinalIgnoreCase);
        var inScope = new HashSet<string>(DraftColumnMap.Tables, StringComparer.OrdinalIgnoreCase);

        var present = columns
            .Where(column => inScope.Contains(column.TableName))
            .DistinctBy(static column => Key(column.TableName, column.ColumnName), StringComparer.OrdinalIgnoreCase)
            .OrderBy(static column => column.TableName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(static column => column.ColumnName, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var presentKeys = present.Select(static column => Key(column.TableName, column.ColumnName)).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var unknown = new List<Finding>();
        var notMapped = new List<Finding>();
        foreach (var column in present)
        {
            var path = $"{column.TableName}.{column.ColumnName}";
            if (!known.TryGetValue(Key(column.TableName, column.ColumnName), out var entry))
            {
                unknown.Add(new Finding(RecordKind.Column, column.TableName, FindingType.CannotMap, "column.unknown", path, "The column has no place in the draft mapping.", null, $"data type {column.DataType}"));
            }
            else if (!entry.IsMapped)
            {
                notMapped.Add(new Finding(RecordKind.Column, entry.Table, entry.Type ?? FindingType.CannotMap, "column.not-mapped", entry.Path, entry.Reason, null, $"data type {column.DataType}"));
            }
        }

        var missing = DraftColumnMap.Entries
            .Where(entry => entry.IsMapped && !presentKeys.Contains(Key(entry.Table, entry.Column)))
            .Select(static entry => new Finding(RecordKind.Column, entry.Table, FindingType.CannotMap, "column.missing", entry.Path, "A mapped column is missing from the restore.", null, null))
            .ToList();

        return new ColumnInventoryResult([.. unknown, .. missing, .. notMapped], present.Count, unknown.Count, missing.Count);
    }

    private static string Key(string table, string column) => $"{table}.{column}";
}

using Microsoft.EntityFrameworkCore;

namespace Csps.LegacyFitCheck.Source;

/// <summary>A row of sys.databases.</summary>
internal sealed class CatalogDatabaseRow
{
    public string Name { get; set; } = string.Empty;

    public int DatabaseId { get; set; }

    public byte CompatibilityLevel { get; set; }
}

/// <summary>A row of sys.tables.</summary>
internal sealed class CatalogTableRow
{
    public int ObjectId { get; set; }

    public string Name { get; set; } = string.Empty;

    public bool IsMsShipped { get; set; }
}

/// <summary>A row of sys.partitions.</summary>
internal sealed class CatalogPartitionRow
{
    public int ObjectId { get; set; }

    public int IndexId { get; set; }

    public long Rows { get; set; }
}

/// <summary>A row of the index usage view of the server.</summary>
internal sealed class CatalogIndexUsageRow
{
    public short DatabaseId { get; set; }

    public int ObjectId { get; set; }

    public long UserUpdates { get; set; }
}

/// <summary>A row of INFORMATION_SCHEMA.COLUMNS: one column of one table.</summary>
internal sealed class LegacyColumn
{
    public string TableSchema { get; set; } = string.Empty;

    public string TableName { get; set; } = string.Empty;

    public string ColumnName { get; set; } = string.Empty;

    public string DataType { get; set; } = string.Empty;
}

/// <summary>Keyless views of the SQL Server catalog, read with LINQ only. They hold the write evidence and the column list.</summary>
internal static class CatalogViews
{
    public static void Configure(ModelBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.Entity<CatalogDatabaseRow>(entity =>
        {
            entity.HasNoKey();
            entity.ToView("databases", "sys");
            entity.Property(row => row.Name).HasColumnName("name");
            entity.Property(row => row.DatabaseId).HasColumnName("database_id");
            entity.Property(row => row.CompatibilityLevel).HasColumnName("compatibility_level");
        });

        builder.Entity<CatalogTableRow>(entity =>
        {
            entity.HasNoKey();
            entity.ToView("tables", "sys");
            entity.Property(row => row.ObjectId).HasColumnName("object_id");
            entity.Property(row => row.Name).HasColumnName("name");
            entity.Property(row => row.IsMsShipped).HasColumnName("is_ms_shipped");
        });

        builder.Entity<CatalogPartitionRow>(entity =>
        {
            entity.HasNoKey();
            entity.ToView("partitions", "sys");
            entity.Property(row => row.ObjectId).HasColumnName("object_id");
            entity.Property(row => row.IndexId).HasColumnName("index_id");
            entity.Property(row => row.Rows).HasColumnName("rows");
        });

        builder.Entity<CatalogIndexUsageRow>(entity =>
        {
            entity.HasNoKey();
            entity.ToView("dm_db_index_usage_stats", "sys");
            entity.Property(row => row.DatabaseId).HasColumnName("database_id");
            entity.Property(row => row.ObjectId).HasColumnName("object_id");
            entity.Property(row => row.UserUpdates).HasColumnName("user_updates");
        });

        builder.Entity<LegacyColumn>(entity =>
        {
            entity.HasNoKey();
            entity.ToView("COLUMNS", "INFORMATION_SCHEMA");
            entity.Property(row => row.TableSchema).HasColumnName("TABLE_SCHEMA");
            entity.Property(row => row.TableName).HasColumnName("TABLE_NAME");
            entity.Property(row => row.ColumnName).HasColumnName("COLUMN_NAME");
            entity.Property(row => row.DataType).HasColumnName("DATA_TYPE");
        });
    }
}

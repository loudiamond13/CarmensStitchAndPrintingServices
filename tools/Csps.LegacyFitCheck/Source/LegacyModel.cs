using Microsoft.EntityFrameworkCore;

namespace Csps.LegacyFitCheck.Source;

/// <summary>One row of the legacy Orders table (only the columns the check reads).</summary>
internal sealed class LegacyOrderRow
{
    public int OrderId { get; set; }

    public string? OrderName { get; set; }

    public DateTime? OrderDate { get; set; }

    public decimal? TotalAmount { get; set; }

    public string? Note { get; set; }

    public bool? IsDeleted { get; set; }

    public decimal PaidAmount { get; set; }

    public decimal TotalDiscount { get; set; }

    public decimal TotalBalance { get; set; }

    public decimal TotalExpenses { get; set; }

    public int? OrderTypeId { get; set; }

    public int? StatusId { get; set; }
}

/// <summary>One row of the legacy OrderItems table.</summary>
internal sealed class LegacyOrderItemRow
{
    public int OrderItemId { get; set; }

    public int OrderId { get; set; }

    public string Description { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public decimal Price { get; set; }
}

/// <summary>One row of the legacy OrderTypes list.</summary>
internal sealed class LegacyOrderTypeRow
{
    public int OrderTypeId { get; set; }

    public string? OrderTypeName { get; set; }
}

/// <summary>One row of the legacy Statuses list.</summary>
internal sealed class LegacyStatusRow
{
    public int StatusId { get; set; }

    public string? StatusName { get; set; }
}

/// <summary>The Fluent mapping of the legacy tables, shared by the read context and the test fake.</summary>
internal static class LegacyModel
{
    public static void Configure(ModelBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.Entity<LegacyOrderRow>(entity =>
        {
            entity.ToTable("Orders");
            entity.HasKey(row => row.OrderId);
            entity.Property(row => row.OrderId).ValueGeneratedNever();
            entity.Property(row => row.OrderName).HasMaxLength(100);
            entity.Property(row => row.OrderDate).HasColumnType("datetime");
            entity.Property(row => row.TotalAmount).HasColumnType("money");
            entity.Property(row => row.Note).HasMaxLength(100);
            entity.Property(row => row.PaidAmount).HasColumnType("money");
            entity.Property(row => row.TotalDiscount).HasColumnType("money");
            entity.Property(row => row.TotalBalance).HasColumnType("money");
            entity.Property(row => row.TotalExpenses).HasColumnType("money");
        });

        builder.Entity<LegacyOrderItemRow>(entity =>
        {
            entity.ToTable("OrderItems");
            entity.HasKey(row => row.OrderItemId);
            entity.Property(row => row.OrderItemId).ValueGeneratedNever();
            entity.Property(row => row.Description).HasMaxLength(100);
            entity.Property(row => row.Price).HasColumnType("money");
        });

        builder.Entity<LegacyOrderTypeRow>(entity =>
        {
            entity.ToTable("OrderTypes");
            entity.HasKey(row => row.OrderTypeId);
            entity.Property(row => row.OrderTypeId).ValueGeneratedNever();
            entity.Property(row => row.OrderTypeName).HasMaxLength(50);
        });

        builder.Entity<LegacyStatusRow>(entity =>
        {
            entity.ToTable("Statuses");
            entity.HasKey(row => row.StatusId);
            entity.Property(row => row.StatusId).ValueGeneratedNever();
            entity.Property(row => row.StatusName).HasMaxLength(30);
        });
    }
}

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

    public bool? IsDone { get; set; }
}

/// <summary>One row of the legacy Payments table.</summary>
internal sealed class LegacyPaymentRow
{
    public int PaymentId { get; set; }

    public int OrderId { get; set; }

    public DateTime PaymentDate { get; set; }

    public string? PaidBy { get; set; }

    public bool? IsDeleted { get; set; }

    public decimal Amount { get; set; }

    public string PaidTo { get; set; } = string.Empty;
}

/// <summary>One row of the legacy Discounts table.</summary>
internal sealed class LegacyDiscountRow
{
    public int OrderDiscountId { get; set; }

    public int OrderId { get; set; }

    public string Description { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string DiscountedBy { get; set; } = string.Empty;
}

/// <summary>One row of the legacy Expenses table, which holds order and company expenses.</summary>
internal sealed class LegacyExpenseRow
{
    public int ExpenseId { get; set; }

    public int? OrderId { get; set; }

    public string Description { get; set; } = string.Empty;

    public DateTime? SpentDate { get; set; }

    public bool IsCompanyExpenses { get; set; }

    public decimal Amount { get; set; }

    public string PaidBy { get; set; } = string.Empty;
}

/// <summary>A legacy login account, read only to match people (id, user name and email, nothing else).</summary>
internal sealed class LegacyUserRow
{
    public string Id { get; set; } = string.Empty;

    public string? UserName { get; set; }

    public string? Email { get; set; }
}

/// <summary>A legacy role, read only to match people.</summary>
internal sealed class LegacyRoleRow
{
    public string Id { get; set; } = string.Empty;

    public string? Name { get; set; }
}

/// <summary>A legacy user and role link.</summary>
internal sealed class LegacyUserRoleRow
{
    public string UserId { get; set; } = string.Empty;

    public string RoleId { get; set; } = string.Empty;
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

        builder.Entity<LegacyPaymentRow>(entity =>
        {
            entity.ToTable("Payments");
            entity.HasKey(row => row.PaymentId);
            entity.Property(row => row.PaymentId).ValueGeneratedNever();
            entity.Property(row => row.PaymentDate).HasColumnType("datetime");
            entity.Property(row => row.PaidBy).HasMaxLength(30);
            entity.Property(row => row.Amount).HasColumnType("money");
            entity.Property(row => row.PaidTo).HasMaxLength(50);
        });

        builder.Entity<LegacyDiscountRow>(entity =>
        {
            entity.ToTable("Discounts");
            entity.HasKey(row => row.OrderDiscountId);
            entity.Property(row => row.OrderDiscountId).ValueGeneratedNever();
            entity.Property(row => row.Description).HasMaxLength(100);
            entity.Property(row => row.Amount).HasColumnType("money");
            entity.Property(row => row.DiscountedBy).HasMaxLength(30);
        });

        builder.Entity<LegacyExpenseRow>(entity =>
        {
            entity.ToTable("Expenses");
            entity.HasKey(row => row.ExpenseId);
            entity.Property(row => row.ExpenseId).ValueGeneratedNever();
            entity.Property(row => row.Description).HasMaxLength(100);
            entity.Property(row => row.SpentDate).HasColumnType("datetime");
            entity.Property(row => row.IsCompanyExpenses).HasColumnName("isCompanyExpenses");
            entity.Property(row => row.Amount).HasColumnType("money");
            entity.Property(row => row.PaidBy).HasMaxLength(50);
        });

        builder.Entity<LegacyUserRow>(entity =>
        {
            entity.ToTable("AspNetUsers");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasMaxLength(450);
            entity.Property(row => row.UserName).HasMaxLength(256);
            entity.Property(row => row.Email).HasMaxLength(256);
        });

        builder.Entity<LegacyRoleRow>(entity =>
        {
            entity.ToTable("AspNetRoles");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasMaxLength(450);
            entity.Property(row => row.Name).HasMaxLength(256);
        });

        builder.Entity<LegacyUserRoleRow>(entity =>
        {
            entity.ToTable("AspNetUserRoles");
            entity.HasKey(row => new { row.UserId, row.RoleId });
            entity.Property(row => row.UserId).HasMaxLength(450);
            entity.Property(row => row.RoleId).HasMaxLength(450);
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

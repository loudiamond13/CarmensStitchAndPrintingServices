using Csps.Domain.Expenses;

namespace Csps.Domain.OrderLists;

/// <summary>One seeded list entry.</summary>
/// <param name="Id">The fixed id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of <see cref="CategoryTones"/>.</param>
public sealed record OrderListSeedRow(Guid Id, string Name, string Tone);

/// <summary>
/// The starting entries of the order lists (D-16, D-17, D-18), shared by the migration seed and the test reseed. Ids and the stamp
/// are literals, never a clock read or a new Guid, so the EF model stays stable between migrations.
/// </summary>
public static class OrderListSeed
{
    /// <summary>The id of the order expense Others, the catch-all that is always listed last and never renamed, retired or deleted.</summary>
    public static readonly Guid OrderExpenseOthersId = new("01a17fce-7810-7507-bf1d-5a04ac95175a");

    /// <summary>The fixed creation stamp of the seeded rows.</summary>
    public static readonly DateTimeOffset SeededAtUtc = new(2026, 10, 28, 0, 0, 0, TimeSpan.Zero);

    /// <summary>The six product types, with the tone each carries.</summary>
    public static IReadOnlyList<OrderListSeedRow> ProductTypes { get; } =
    [
        new(new Guid("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6"), "Basketball Jersey", CategoryTones.Accent),
        new(new Guid("01a17fce-7801-7e45-b875-357767854eda"), "Volleyball Jersey", CategoryTones.Info),
        new(new Guid("01a17fce-7802-7097-a1d7-d09eec3abeff"), "Moto Riding Jersey", CategoryTones.Warning),
        new(new Guid("01a17fce-7803-7e5c-a7ef-616e966d8a4c"), "Long Sleeves", CategoryTones.Mockup),
        new(new Guid("01a17fce-7804-7ac7-a63c-7c6a1ec5bad4"), "Polo Shirt", CategoryTones.Success),
        new(new Guid("01a17fce-7805-7744-aa72-f1641ce2b2bd"), "Custom Design", CategoryTones.Neutral),
    ];

    /// <summary>The five payment methods, with the tone each carries in the UI spec.</summary>
    public static IReadOnlyList<OrderListSeedRow> PaymentMethods { get; } =
    [
        new(new Guid("01a17fce-7806-77e1-91b7-d3b852f2fd1d"), "Cash", CategoryTones.Neutral),
        new(new Guid("01a17fce-7807-751a-bb7b-3719f2840928"), "GCash", CategoryTones.Info),
        new(new Guid("01a17fce-7808-7b8c-b615-89ae2b4062c3"), "Maya", CategoryTones.Success),
        new(new Guid("01a17fce-7809-72b7-8803-599045f879c9"), "Bank Transfer", CategoryTones.Mockup),
        new(new Guid("01a17fce-780a-7fca-bf36-c6229c6ddd4a"), "Cheque", CategoryTones.Warning),
    ];

    /// <summary>The six order expense categories; Others is the protected catch-all.</summary>
    public static IReadOnlyList<OrderListSeedRow> OrderExpenseCategories { get; } =
    [
        new(new Guid("01a17fce-780b-75d1-89e0-5b3b9b185a2c"), "Fabric", CategoryTones.Info),
        new(new Guid("01a17fce-780c-73e0-b847-33f866e42d3d"), "Ink & paper", CategoryTones.Accent),
        new(new Guid("01a17fce-780d-75c8-b20b-2b2cc64dddfa"), "Outsourcing", CategoryTones.Mockup),
        new(new Guid("01a17fce-780e-700c-90b2-d45ecdc6df9d"), "Labor", CategoryTones.Warning),
        new(new Guid("01a17fce-780f-79e1-b611-1952e5eb8893"), "Delivery", CategoryTones.Success),
        new(OrderExpenseOthersId, "Others", CategoryTones.Neutral),
    ];

    /// <summary>Gets the starting rows of one list.</summary>
    /// <param name="kind">Which list.</param>
    /// <returns>The rows.</returns>
    public static IReadOnlyList<OrderListSeedRow> Rows(OrderListKind kind) => kind switch
    {
        OrderListKind.ProductType => ProductTypes,
        OrderListKind.PaymentMethod => PaymentMethods,
        OrderListKind.OrderExpenseCategory => OrderExpenseCategories,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown order list."),
    };
}

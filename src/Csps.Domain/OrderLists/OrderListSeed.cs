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
}

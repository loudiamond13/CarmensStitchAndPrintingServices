namespace Csps.Domain.Expenses;

/// <summary>One seeded expense category.</summary>
/// <param name="Id">The fixed id.</param>
/// <param name="Name">The display name.</param>
/// <param name="Tone">One of <see cref="CategoryTones"/>.</param>
public sealed record ExpenseCategorySeedRow(Guid Id, string Name, string Tone);

/// <summary>
/// The ten categories every database starts with (D-09), shared by the migration seed and the test reseed. Ids and the
/// stamp are literals, never a clock read or a new Guid, so the EF model stays stable between migrations.
/// </summary>
public static class ExpenseCategorySeed
{
    /// <summary>The id of Others, the catch-all that is always listed last (D-15).</summary>
    public static readonly Guid OthersId = new("f85e6b1c-b46f-4a00-8c4e-5148eb3b9704");

    /// <summary>The fixed creation stamp of the seeded rows.</summary>
    public static readonly DateTimeOffset SeededAtUtc = new(2026, 10, 25, 0, 0, 0, TimeSpan.Zero);

    /// <summary>The ten rows, with the tone each carries in the UI spec (D-13).</summary>
    public static IReadOnlyList<ExpenseCategorySeedRow> Rows { get; } =
    [
        new(new Guid("6869715c-a01f-4053-87d8-8fd39feebebc"), "Rent", CategoryTones.Accent),
        new(new Guid("51702a8f-81e4-4a20-8e39-2d4b270793de"), "Utilities", CategoryTones.Info),
        new(new Guid("d2aa53b4-7ebd-445e-b318-94ce1d21cbf2"), "Salaries", CategoryTones.Mockup),
        new(new Guid("447ad32e-1433-4b70-8786-72e3dc3f9937"), "Supplies", CategoryTones.Warning),
        new(new Guid("b9c92751-7040-4edd-bd44-de110104cb01"), "Equipment", CategoryTones.Success),
        new(new Guid("b74d786b-8092-4e67-a0ba-a419e9d1ba75"), "Maintenance", CategoryTones.Neutral),
        new(new Guid("b27a1f8a-5262-48c8-bca4-41e04583e015"), "Government contributions", CategoryTones.Info),
        new(new Guid("c8392b0c-ee0e-4a71-ba47-b137fdd1d8c0"), "Taxes and permits", CategoryTones.Mockup),
        new(new Guid("eb48e6a0-08a8-4509-9f5e-7b81167071de"), "Transport and fuel", CategoryTones.Warning),
        new(OthersId, "Others", CategoryTones.Neutral),
    ];
}

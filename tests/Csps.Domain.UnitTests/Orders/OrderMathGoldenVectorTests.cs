using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>
/// Golden vectors (WEB-07, D-09): <see cref="OrderMath.Compute"/> must give exactly the figures of the shared vector
/// file that the web suite (web/src/lib/csps.golden.test.ts) also checks. The file is only read here; regenerate it
/// with <c>node web/scripts/gen-golden-vectors.mjs --write</c>.
/// </summary>
public sealed class OrderMathGoldenVectorTests
{
    private const string OperationOrder =
        "round the items total; round each discount; sum the discounts and round the sum; subtract (D-09)";

    private static readonly Lazy<VectorFile> Vectors = new(Load);

    /// <summary>Every case id in the shared file (short theory display names).</summary>
    public static TheoryData<string> CaseIds
    {
        get
        {
            var data = new TheoryData<string>();
            foreach (var vector in Vectors.Value.Cases)
            {
                data.Add(vector.Id);
            }

            return data;
        }
    }

    [Fact]
    public void PinsTheOperationOrder()
    {
        Vectors.Value.Version.ShouldBe(2);
        Vectors.Value.OperationOrder.ShouldBe(OperationOrder);
    }

    [Fact]
    public void HasAtLeast200CasesWithUniqueIds()
    {
        Vectors.Value.Cases.Count.ShouldBeGreaterThanOrEqualTo(200);
        Vectors.Value.Cases.Select(c => c.Id).Distinct(StringComparer.Ordinal).Count().ShouldBe(Vectors.Value.Cases.Count);
    }

    // Every category the generator must cover (WEB-07); the Vitest suite asserts the same list.
    [Theory]
    [InlineData("midpoint")]
    [InlineData("ord-fixture")]
    [InlineData("percent-100")]
    [InlineData("zero-items")]
    [InlineData("multi-discount")]
    [InlineData("negative-balance")]
    [InlineData("large-value")]
    [InlineData("seeded-random")]
    public void CoversTheCategory(string category)
    {
        Vectors.Value.Cases.ShouldContain(c => c.Category == category);
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void MatchesVector(string caseId)
    {
        var vector = Vectors.Value.Cases.Single(c => c.Id == caseId);

        var result = OrderMath.Compute(
            [.. vector.Items.Select(i => new OrderMathItem(i.Quantity, Amount(i.UnitPrice)))],
            [.. vector.Discounts.Select(ToDiscount)],
            [.. vector.Payments.Select(Amount)],
            [.. vector.Expenses.Select(Amount)]);

        Format(result).ShouldBe(vector.Expected, vector.Note);
    }

    private static decimal Amount(string value) =>
        decimal.Parse(value, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture);

    private static OrderMathDiscount ToDiscount(VectorDiscount discount) => discount.Kind switch
    {
        "percentage" => new OrderMathDiscount(DiscountKind.Percentage, Amount(discount.Value)),
        "fixed" => new OrderMathDiscount(DiscountKind.Fixed, Amount(discount.Value)),
        _ => throw new InvalidOperationException($"Unknown discount kind '{discount.Kind}'."),
    };

    private static VectorExpected Format(OrderMathResult result) => new(
        Text(result.Subtotal),
        Text(result.Discount),
        Text(result.Total),
        Text(result.Paid),
        Text(result.Balance),
        Text(result.Expenses),
        Text(result.Profit),
        result.FullyPaid);

    private static string Text(decimal amount) => amount.ToString("0.00", CultureInfo.InvariantCulture);

    private static VectorFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "order-math-golden-vectors.json");
        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<VectorFile>(json, StrictOptions)
            ?? throw new InvalidOperationException("The golden-vector file is empty.");
    }

    // Fails closed (D-41 R2-06): a renamed, missing or unknown member is an error, never a silent default, so the file
    // and this record can never drift apart on what "total" means.
    private static readonly JsonSerializerOptions StrictOptions = new(JsonSerializerOptions.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        RespectRequiredConstructorParameters = true,
    };

    private sealed record VectorFile(int Version, string OperationOrder, IReadOnlyList<VectorCase> Cases);

    private sealed record VectorCase(
        string Id,
        string Category,
        string Note,
        IReadOnlyList<VectorItem> Items,
        IReadOnlyList<VectorDiscount> Discounts,
        IReadOnlyList<string> Payments,
        IReadOnlyList<string> Expenses,
        VectorExpected Expected);

    private sealed record VectorItem(int Quantity, string UnitPrice);

    private sealed record VectorDiscount(string Kind, string Value);

    private sealed record VectorExpected(
        string Subtotal,
        string Discount,
        string Total,
        string Paid,
        string Balance,
        string Expenses,
        string Profit,
        bool FullyPaid);
}

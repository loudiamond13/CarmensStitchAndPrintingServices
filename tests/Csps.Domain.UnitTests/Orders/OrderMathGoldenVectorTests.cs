using System.Globalization;
using System.Text.Json;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>
/// Golden vectors (WEB-07, D-09): <see cref="OrderMath.Compute"/> must give exactly the figures of the shared vector
/// file that the web suite (web/src/lib/csps.golden.test.ts) also checks. The file is only read here; regenerate it
/// with <c>node web/scripts/gen-golden-vectors.mjs</c>.
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
        Vectors.Value.SchemaVersion.ShouldBe(1);
        Vectors.Value.OperationOrder.ShouldBe(OperationOrder);
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void MatchesEveryVector(string caseId)
    {
        var vector = Vectors.Value.Cases.Single(c => c.Id == caseId);

        var totals = OrderMath.Compute(
            [.. vector.Items.Select(i => new OrderMathItem(int.Parse(i.Quantity, CultureInfo.InvariantCulture), Amount(i.UnitPrice)))],
            [.. vector.Discounts.Select(ToDiscount)],
            [.. vector.Payments.Select(Amount)],
            [.. vector.Expenses.Select(Amount)]);

        Format(totals).ShouldBe(vector.Expected, vector.Note);
    }

    private static decimal Amount(string value) => decimal.Parse(value, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture);

    private static OrderMathDiscount ToDiscount(VectorDiscount discount) => discount.Type switch
    {
        "percentage" => new OrderMathDiscount(DiscountKind.Percentage, Amount(discount.Value)),
        "fixed" => new OrderMathDiscount(DiscountKind.Fixed, Amount(discount.Value)),
        _ => throw new InvalidOperationException($"Unknown discount type '{discount.Type}'."),
    };

    private static VectorExpected Format(OrderMathTotals totals) => new(
        Text(totals.Total),
        Text(totals.Discount),
        Text(totals.Paid),
        Text(totals.Balance),
        Text(totals.Expenses),
        Text(totals.Profit),
        totals.FullyPaid);

    private static string Text(decimal amount) => amount.ToString("0.00", CultureInfo.InvariantCulture);

    private static VectorFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "order-math-golden-vectors.json");
        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<VectorFile>(json, JsonSerializerOptions.Web)
            ?? throw new InvalidOperationException("The golden-vector file is empty.");
    }

    private sealed record VectorFile(int SchemaVersion, string OperationOrder, IReadOnlyList<VectorCase> Cases);

    private sealed record VectorCase(
        string Id,
        string Category,
        string Note,
        IReadOnlyList<VectorItem> Items,
        IReadOnlyList<VectorDiscount> Discounts,
        IReadOnlyList<string> Payments,
        IReadOnlyList<string> Expenses,
        VectorExpected Expected);

    private sealed record VectorItem(string Quantity, string UnitPrice);

    private sealed record VectorDiscount(string Type, string Value);

    private sealed record VectorExpected(
        string Total,
        string Discount,
        string Paid,
        string Balance,
        string Expenses,
        string Profit,
        bool FullyPaid);
}

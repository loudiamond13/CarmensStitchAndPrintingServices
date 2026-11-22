using System.Globalization;
using Csps.Application.Analytics;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>
/// ANL-08, D-69, CWE-1236: the export is the header <c>Date,Page,Page views</c>, then one CRLF line per day and page with the date as YYYY-MM-DD,
/// the page's name and the count as plain digits. No cell can start a spreadsheet formula or break the line.
/// </summary>
public sealed class VisitorStatsCsvTests
{
    // A spreadsheet treats a cell that starts with one of these as a formula (CWE-1236).
    private static readonly char[] FormulaStarts = ['=', '+', '-', '@', '\t', '\r'];

    private static readonly DailyPageRow[] Mixed =
    [
        new(new DateOnly(2025, 10, 13), "Home", 12),
        new(new DateOnly(2025, 10, 13), "Privacy Policy", 1),
        new(new DateOnly(2026, 11, 15), "Accessibility Statement", int.MaxValue),
        new(new DateOnly(2026, 11, 15), "Page not found", 0),
    ];

    [Fact(DisplayName = "writes the three-column header and one line per row")]
    public void WritesTheThreeColumnHeaderAndOneLinePerRow()
    {
        DailyPageRow[] rows =
        [
            new(new DateOnly(2026, 11, 1), "Home", 3),
            new(new DateOnly(2026, 11, 1), "Gallery", 1),
        ];

        var csv = VisitorStatsCsv.Write(rows);

        csv.ShouldBe("Date,Page,Page views\r\n2026-11-01,Home,3\r\n2026-11-01,Gallery,1\r\n");
    }

    [Fact(DisplayName = "writes the header alone for no rows")]
    public void WritesTheHeaderAloneForNoRows()
    {
        VisitorStatsCsv.Header.ShouldBe("Date,Page,Page views");
        VisitorStatsCsv.Write([]).ShouldBe("Date,Page,Page views\r\n");
    }

    [Theory(DisplayName = "rejects a page text that could start a formula or break a cell")]
    [InlineData("=SUM(A1:A9)")]
    [InlineData("+1")]
    [InlineData("-1")]
    [InlineData("@cmd")]
    [InlineData("\tHome")]
    [InlineData("\rHome")]
    [InlineData(" Home")]
    [InlineData("1Home")]
    [InlineData("")]
    [InlineData("Home,Products")]
    [InlineData("Ho\"me")]
    [InlineData("Ho\nme")]
    [InlineData("Ho\rme")]
    public void RejectsAPageTextThatCouldStartAFormulaOrBreakACell(string page)
    {
        Should.Throw<ArgumentException>(() => VisitorStatsCsv.Write([new DailyPageRow(new DateOnly(2026, 11, 15), page, 1)]));
    }

    [Fact]
    public void NoCellOfAGeneratedFileStartsAFormula()
    {
        var cells = VisitorStatsCsv.Write(Mixed).Split("\r\n").SelectMany(static line => line.Split(','));

        cells.ShouldAllBe(static cell => !StartsAFormula(cell));
    }

    [Theory]
    [InlineData("=SUM(A1:A9)")]
    [InlineData("+1")]
    [InlineData("-1")]
    [InlineData("@cmd")]
    [InlineData("\tx")]
    [InlineData("\rx")]
    public void TheFormulaCheckCatchesEveryDangerousStart(string cell) => StartsAFormula(cell).ShouldBeTrue();

    [Fact]
    public void EveryLineHasExactlyTheThreeColumnsAndTheFileEndsWithALineEnd()
    {
        var csv = VisitorStatsCsv.Write(Mixed);

        csv.ShouldEndWith("\r\n");
        var lines = csv[..^2].Split("\r\n");
        lines.Length.ShouldBe(5);
        lines.ShouldAllBe(static line => line.Split(',').Length == 3);
        csv.Replace("\r\n", string.Empty, StringComparison.Ordinal).ShouldNotContain('\n');
        csv.Replace("\r\n", string.Empty, StringComparison.Ordinal).ShouldNotContain('\r');
    }

    [Fact]
    public void ANegativeCountIsRefusedBecauseItsCellWouldStartWithAMinusSign()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => VisitorStatsCsv.Write([new DailyPageRow(new DateOnly(2026, 11, 15), "Home", -5)]));
    }

    [Fact]
    public void DatesAndCountsAreInvariantWhateverTheThreadCulture()
    {
        var before = CultureInfo.CurrentCulture;
        try
        {
            // The Thai culture counts years in the Buddhist era (2569) and the Arabic one may use other digits.
            CultureInfo.CurrentCulture = new CultureInfo("th-TH");
            var thai = VisitorStatsCsv.Write([new DailyPageRow(new DateOnly(2026, 11, 15), "Home", 67890)]);
            CultureInfo.CurrentCulture = new CultureInfo("ar-SA");
            var arabic = VisitorStatsCsv.Write([new DailyPageRow(new DateOnly(2026, 11, 15), "Home", 67890)]);

            thai.ShouldBe("Date,Page,Page views\r\n2026-11-15,Home,67890\r\n");
            arabic.ShouldBe(thai);
        }
        finally
        {
            CultureInfo.CurrentCulture = before;
        }
    }

    private static bool StartsAFormula(string cell) => cell.Length > 0 && FormulaStarts.Contains(cell[0]);
}

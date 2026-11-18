using System.Globalization;
using Csps.Application.Analytics;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>
/// ANL-08, D-25, D-27, D-33, CWE-1236: the export is the header, then one CRLF line per business day with the date as YYYY-MM-DD and the
/// counts as plain digits. A count that is not kept is an empty cell, and no cell can start a spreadsheet formula.
/// </summary>
public sealed class VisitorStatsCsvTests
{
    // A spreadsheet treats a cell that starts with one of these as a formula (CWE-1236).
    private static readonly char[] FormulaStarts = ['=', '+', '-', '@', '\t', '\r'];

    private static readonly DailyStatsRow[] Mixed =
    [
        new(new DateOnly(2025, 10, 13), null, null, 12),
        new(new DateOnly(2025, 10, 14), null, null, 0),
        new(new DateOnly(2025, 10, 15), 2, 3, 8),
        new(new DateOnly(2026, 11, 15), int.MaxValue, 0, int.MaxValue),
    ];

    [Fact]
    public void AThreeDayRangeIsTheHeaderThenOneLinePerDay()
    {
        DailyStatsRow[] rows =
        [
            new(new DateOnly(2026, 11, 13), 3, 4, 12),
            new(new DateOnly(2026, 11, 14), 0, 0, 0),
            new(new DateOnly(2026, 11, 15), 1234, 1500, 4567),
        ];

        var csv = VisitorStatsCsv.Write(rows);

        csv.ShouldBe("Date,Unique visitors,Visits,Page views\r\n2026-11-13,3,4,12\r\n2026-11-14,0,0,0\r\n2026-11-15,1234,1500,4567\r\n");
    }

    [Fact]
    public void ACountThatIsNotKeptIsAnEmptyCellNotZero()
    {
        var csv = VisitorStatsCsv.Write([new DailyStatsRow(new DateOnly(2025, 10, 13), null, null, 12)]);

        csv.ShouldBe("Date,Unique visitors,Visits,Page views\r\n2025-10-13,,,12\r\n");
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
    public void EveryLineHasExactlyTheFourColumnsAndTheFileEndsWithALineEnd()
    {
        var csv = VisitorStatsCsv.Write(Mixed);

        csv.ShouldEndWith("\r\n");
        var lines = csv[..^2].Split("\r\n");
        lines.Length.ShouldBe(5);
        lines.ShouldAllBe(static line => line.Split(',').Length == 4);
        csv.Replace("\r\n", string.Empty, StringComparison.Ordinal).ShouldNotContain('\n');
        csv.Replace("\r\n", string.Empty, StringComparison.Ordinal).ShouldNotContain('\r');
    }

    [Fact]
    public void ANegativeCountIsRefusedBecauseItsCellWouldStartWithAMinusSign()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => VisitorStatsCsv.Write([new DailyStatsRow(new DateOnly(2026, 11, 15), -1, 0, 0)]));
        Should.Throw<ArgumentOutOfRangeException>(() => VisitorStatsCsv.Write([new DailyStatsRow(new DateOnly(2026, 11, 15), 0, 0, -5)]));
    }

    [Fact]
    public void DatesAndCountsAreInvariantWhateverTheThreadCulture()
    {
        var before = CultureInfo.CurrentCulture;
        try
        {
            // The Thai culture counts years in the Buddhist era (2569) and the Arabic one may use other digits.
            CultureInfo.CurrentCulture = new CultureInfo("th-TH");
            var thai = VisitorStatsCsv.Write([new DailyStatsRow(new DateOnly(2026, 11, 15), 1234, 5, 67890)]);
            CultureInfo.CurrentCulture = new CultureInfo("ar-SA");
            var arabic = VisitorStatsCsv.Write([new DailyStatsRow(new DateOnly(2026, 11, 15), 1234, 5, 67890)]);

            thai.ShouldBe("Date,Unique visitors,Visits,Page views\r\n2026-11-15,1234,5,67890\r\n");
            arabic.ShouldBe(thai);
        }
        finally
        {
            CultureInfo.CurrentCulture = before;
        }
    }

    [Fact]
    public void TheHeaderIsTheD33Wording()
    {
        VisitorStatsCsv.Header.ShouldBe("Date,Unique visitors,Visits,Page views");
        VisitorStatsCsv.Write([]).ShouldBe("Date,Unique visitors,Visits,Page views\r\n");
    }

    private static bool StartsAFormula(string cell) => cell.Length > 0 && FormulaStarts.Contains(cell[0]);
}

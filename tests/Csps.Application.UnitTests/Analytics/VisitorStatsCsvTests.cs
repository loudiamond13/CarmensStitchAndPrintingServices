using Csps.Application.Analytics;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>
/// ANL-08, D-25, D-33: the export is the header, then one CRLF line per business day with the date as YYYY-MM-DD and the counts as plain digits.
/// </summary>
public sealed class VisitorStatsCsvTests
{
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
}

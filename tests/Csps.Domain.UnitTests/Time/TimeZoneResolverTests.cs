using Csps.Domain.Time;

namespace Csps.Domain.UnitTests.Time;

/// <summary>D-02 fallback chain: stored id, then Asia/Manila (IANA), then Singapore Standard Time, then fixed UTC+08.</summary>
public sealed class TimeZoneResolverTests
{
    private static readonly TimeSpan Manila = TimeSpan.FromHours(8);

    [Fact]
    public void ResolvesStoredZone()
    {
        var (zone, source) = TimeZoneResolver.Resolve("Asia/Manila");

        source.ShouldBe(ZoneSource.Stored);
        zone.BaseUtcOffset.ShouldBe(Manila);
        zone.GetUtcOffset(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)).ShouldBe(Manila);
        zone.GetUtcOffset(new DateTimeOffset(2026, 7, 1, 0, 0, 0, TimeSpan.Zero)).ShouldBe(Manila);
    }

    [Fact]
    public void FallsBackToIanaWhenStoredIdUnknown()
    {
        var (zone, source) = TimeZoneResolver.Resolve("Mars/Olympus");

        source.ShouldBe(ZoneSource.FallbackIana);
        zone.Id.ShouldBeOneOf(TimeZoneResolver.DefaultIana, TimeZoneResolver.DefaultWindows);
        zone.BaseUtcOffset.ShouldBe(Manila);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void FallsBackForNullAndBlank(string? storedId)
    {
        var (zone, source) = TimeZoneResolver.Resolve(storedId);

        source.ShouldBe(ZoneSource.FallbackIana);
        zone.BaseUtcOffset.ShouldBe(Manila);
    }

    [Fact]
    public void StoredZoneWinsOverTheDefaults()
    {
        var stored = TimeZoneInfo.CreateCustomTimeZone("Test/Stored", TimeSpan.FromHours(3), "Stored", "Stored");

        var (zone, source) = TimeZoneResolver.Resolve("Test/Stored", id => id == "Test/Stored" ? stored : Known(id));

        source.ShouldBe(ZoneSource.Stored);
        zone.ShouldBeSameAs(stored);
    }

    [Fact]
    public void FallsBackToWindowsIdWhenIanaMissing()
    {
        var singapore = TimeZoneInfo.CreateCustomTimeZone(TimeZoneResolver.DefaultWindows, Manila, "Singapore", "Singapore");

        var (zone, source) = TimeZoneResolver.Resolve("Mars/Olympus", id => id == TimeZoneResolver.DefaultWindows ? singapore : null);

        source.ShouldBe(ZoneSource.FallbackWindows);
        zone.ShouldBeSameAs(singapore);
    }

    [Fact]
    public void FallsBackToFixedOffsetWhenNothingResolves()
    {
        var (zone, source) = TimeZoneResolver.Resolve("Asia/Manila", _ => null);

        source.ShouldBe(ZoneSource.FixedOffset);
        zone.BaseUtcOffset.ShouldBe(Manila);
        zone.SupportsDaylightSavingTime.ShouldBeFalse();
        zone.GetUtcOffset(new DateTimeOffset(2026, 6, 1, 0, 0, 0, TimeSpan.Zero)).ShouldBe(Manila);
    }

    // Stand-in for the system lookup in the injected-lookup tests.
    private static TimeZoneInfo? Known(string id) =>
        TimeZoneInfo.TryFindSystemTimeZoneById(id, out var zone) ? zone : null;
}

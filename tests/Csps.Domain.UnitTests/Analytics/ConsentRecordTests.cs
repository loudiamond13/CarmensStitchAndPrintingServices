using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>ANL-07, ANL-02, T-12-21: a consent record holds the whole decision, is made only by <c>Decide</c> and refuses a state that cannot be true.</summary>
public sealed class ConsentRecordTests
{
    private static readonly Guid Chain = Guid.Parse("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d");
    private static readonly DateTimeOffset At = new(2026, 11, 16, 3, 30, 0, TimeSpan.Zero);

    [Fact]
    public void DecideKeepsEveryValueOfTheDecision()
    {
        var record = ConsentRecord.Decide(Chain, "1.0", true, true, false, ConsentSource.Bar, At);

        record.ConsentId.ShouldBe(Chain);
        record.PolicyVersion.ShouldBe("1.0");
        record.Stats.ShouldBe(true);
        record.Map.ShouldBeTrue();
        record.Gpc.ShouldBeFalse();
        record.Source.ShouldBe(ConsentSource.Bar);
        record.DecidedAtUtc.ShouldBe(At);
    }

    [Fact]
    public void ANotChosenStatsValueStaysNull()
    {
        var record = ConsentRecord.Decide(Chain, "1.0", null, true, false, ConsentSource.MapLink, At);

        record.Stats.ShouldBeNull();
        record.Map.ShouldBeTrue();
    }

    [Fact]
    public void EachDecisionGetsItsOwnId()
    {
        var first = ConsentRecord.Decide(Chain, "1.0", true, true, false, ConsentSource.Bar, At);
        var second = ConsentRecord.Decide(Chain, "1.0", true, true, false, ConsentSource.Bar, At);

        first.Id.ShouldNotBe(Guid.Empty);
        second.Id.ShouldNotBe(Guid.Empty);
        second.Id.ShouldNotBe(first.Id);
        second.ConsentId.ShouldBe(first.ConsentId);
    }

    [Theory]
    [InlineData(ConsentSource.Bar, 1)]
    [InlineData(ConsentSource.Settings, 2)]
    [InlineData(ConsentSource.MapLink, 3)]
    [InlineData(ConsentSource.Clear, 4)]
    public void TheSourceNumbersAreWhatTheDatabaseStores(ConsentSource source, byte number) =>
        ((byte)source).ShouldBe(number);

    [Fact]
    public void ADecisionUnderGpcCanStoreStatsOffWithTheGpcFlag()
    {
        var record = ConsentRecord.Decide(Chain, "1.0", false, true, true, ConsentSource.Settings, At);

        record.Gpc.ShouldBeTrue();
        record.Stats.ShouldBe(false);
    }

    [Fact]
    public void StatsOnUnderGpcIsRefused() =>
        Should.Throw<ArgumentException>(() => ConsentRecord.Decide(Chain, "1.0", true, false, true, ConsentSource.Bar, At));

    [Fact]
    public void AnEmptyChainIdIsRefused() =>
        Should.Throw<ArgumentException>(() => ConsentRecord.Decide(Guid.Empty, "1.0", true, true, false, ConsentSource.Bar, At));

    [Theory]
    [InlineData("")]
    [InlineData("1")]
    [InlineData("1.")]
    [InlineData(".1")]
    [InlineData("1.0.0")]
    [InlineData("a.b")]
    [InlineData("12345678.123456789")]
    public void APolicyVersionThatIsNotDigitsDotDigitsWithinTheColumnIsRefused(string version) =>
        Should.Throw<ArgumentException>(() => ConsentRecord.Decide(Chain, version, true, true, false, ConsentSource.Bar, At));

    [Fact]
    public void ANullPolicyVersionIsRefused() =>
        Should.Throw<ArgumentException>(() => ConsentRecord.Decide(Chain, null!, true, true, false, ConsentSource.Bar, At));

    [Fact]
    public void ASourceThatIsNotNamedIsRefused() =>
        Should.Throw<ArgumentOutOfRangeException>(() => ConsentRecord.Decide(Chain, "1.0", true, true, false, (ConsentSource)99, At));
}

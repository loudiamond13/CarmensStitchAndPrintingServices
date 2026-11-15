using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>CONT-02, CWE-601: a line's URL key is made once from its short name, is unique, and only a well-formed key reaches a link.</summary>
public sealed class LineKeyTests
{
    private static readonly IReadOnlySet<string> None = new HashSet<string>(StringComparer.Ordinal);

    [Theory]
    [InlineData("Long Sleeves", "long-sleeves")]
    [InlineData("Moto & MTB!", "moto-mtb")]
    [InlineData("Shorts", "shorts")]
    [InlineData("  Polo  ", "polo")]
    [InlineData("Jersey 23", "jersey-23")]
    [InlineData("A--B", "a-b")]
    public void AKeyIsLowerCaseLettersAndDigitsJoinedByDashes(string shortName, string expected) =>
        LineKey.From(shortName, None).ShouldBe(expected);

    [Fact]
    public void ATakenKeyGetsTheNextFreeNumberSuffix()
    {
        LineKey.From("Polo", new HashSet<string>(StringComparer.Ordinal) { "polo" }).ShouldBe("polo-2");
        LineKey.From("Polo", new HashSet<string>(StringComparer.Ordinal) { "polo", "polo-2" }).ShouldBe("polo-3");
    }

    [Theory]
    [InlineData("!!!")]
    [InlineData("   ")]
    [InlineData("éè")]
    public void AShortNameWithNoLettersOrDigitsStillGetsAKey(string shortName) =>
        LineKey.From(shortName, None).ShouldBe("line");

    [Fact]
    public void ALongShortNameStaysWithinTheKeyLimitWithItsSuffix()
    {
        var taken = new HashSet<string>(StringComparer.Ordinal) { new('a', ProductLine.KeyMaxLength) };

        var key = LineKey.From(new string('a', 100), taken);

        key.Length.ShouldBeLessThanOrEqualTo(ProductLine.KeyMaxLength);
        key.ShouldEndWith("-2");
        LineKey.IsValid(key).ShouldBeTrue();
    }

    [Theory]
    [InlineData("basketball")]
    [InlineData("long-sleeves")]
    [InlineData("longsleeves")]
    [InlineData("polo-2")]
    [InlineData("a1")]
    public void AWellFormedKeyIsValid(string key) => LineKey.IsValid(key).ShouldBeTrue();

    [Theory]
    [InlineData("Bad Key")]
    [InlineData("../x")]
    [InlineData("javascript:x")]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("Polo")]
    [InlineData("a--b")]
    [InlineData("-a")]
    [InlineData("a-")]
    public void AnythingElseIsNotAKey(string? key) => LineKey.IsValid(key).ShouldBeFalse();

    [Fact]
    public void AKeyLongerThanTheLimitIsNotAKey() => LineKey.IsValid(new string('a', ProductLine.KeyMaxLength + 1)).ShouldBeFalse();

    [Fact]
    public void EverySeededKeyIsValid() => ProductLineSeed.All.ShouldAllBe(entry => LineKey.IsValid(entry.Key));
}

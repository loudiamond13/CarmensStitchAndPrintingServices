using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

public sealed class ReferrerNameTests
{
    [Fact]
    public void TheSourceColumnLengthIs253()
    {
        ReferrerName.MaxLength.ShouldBe(253);
    }
}

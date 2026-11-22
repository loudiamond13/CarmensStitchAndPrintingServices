using System.Reflection;
using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

public sealed class ReferrerNameTests
{
    [Fact]
    public void TheSourceColumnLengthIs253()
    {
        ReferrerName.MaxLength.ShouldBe(253);
    }

    // D-56: nothing groups a referrer any more, so the type holds only the column length.
    [Fact]
    public void HoldsOnlyTheColumnLength() =>
        typeof(ReferrerName).GetMembers(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly)
            .Select(member => member.Name).ShouldBe(["MaxLength"]);
}

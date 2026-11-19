using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

public sealed class ReferrerNameTests
{
    [Fact]
    public void HasNoFromHelperBecauseNothingGroupsAReferrerAnyMore()
    {
        typeof(ReferrerName).GetMember("From").ShouldBeEmpty();
    }

    [Fact]
    public void NamesAreTheFixedLabels()
    {
        ReferrerName.Facebook.ShouldBe("Facebook");
        ReferrerName.Messenger.ShouldBe("Messenger");
        ReferrerName.Instagram.ShouldBe("Instagram");
        ReferrerName.Google.ShouldBe("Google");
        ReferrerName.Direct.ShouldBe("Direct");
        ReferrerName.MaxLength.ShouldBe(253);
    }
}

using Csps.Application.Users;

namespace Csps.Application.UnitTests.Users;

/// <summary>D-16, D-18, UI-SPEC U1: the status and invitation text follow one precedence everywhere.</summary>
public sealed class UserStatusesTests
{
    [Theory]
    [InlineData(true, false, "active")]
    [InlineData(true, true, "locked")]
    [InlineData(false, false, "inactive")]
    [InlineData(false, true, "inactive")]
    public void InactiveBeatsLockedAndLockedBeatsActive(bool isActive, bool managerLocked, string expected)
    {
        UserStatuses.Of(isActive, managerLocked).ShouldBe(expected);
    }

    [Theory]
    [InlineData(true, false, "none")]
    [InlineData(true, true, "none")]
    [InlineData(false, true, "pending")]
    [InlineData(false, false, "expired")]
    public void OnlyAnAccountWithNoPasswordCanBePendingOrExpired(bool hasPassword, bool liveInvitation, string expected)
    {
        InviteStates.Of(hasPassword, liveInvitation).ShouldBe(expected);
    }
}

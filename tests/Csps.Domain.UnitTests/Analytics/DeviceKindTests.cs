using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>The device kinds are stored as numbers in the kept analytics tables (D-56), so their values must not move.</summary>
public sealed class DeviceKindTests
{
    [Fact]
    public void KindsHaveTheStoredValues()
    {
        ((byte)DeviceKind.Phone).ShouldBe((byte)1);
        ((byte)DeviceKind.Tablet).ShouldBe((byte)2);
        ((byte)DeviceKind.Computer).ShouldBe((byte)3);
        ((byte)DeviceKind.Other).ShouldBe((byte)4);
    }
}

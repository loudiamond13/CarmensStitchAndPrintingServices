using Csps.Testing;

namespace Csps.Infrastructure.IntegrationTests.Fixture;

/// <summary>The drop guard: test code may drop only <c>^CSPS_Test_[0-9a-f-]{36}$</c> databases (T-01-05).</summary>
public sealed class TestDatabaseNameTests
{
    private const string LowercaseGuid = "0f8fad5b-d9cb-469f-a165-70867728950e";

    [Fact]
    public void AcceptsTestPrefixWithLowercaseGuid()
    {
        TestDatabaseName.IsDisposable("CSPS_Test_" + LowercaseGuid).ShouldBeTrue();
    }

    [Fact]
    public void NewNameIsDisposableAndUnique()
    {
        var first = TestDatabaseName.NewName();
        var second = TestDatabaseName.NewName();

        TestDatabaseName.IsDisposable(first).ShouldBeTrue();
        TestDatabaseName.IsDisposable(second).ShouldBeTrue();
        first.ShouldNotBe(second);
    }

    [Theory]
    [InlineData("BetsLLC_Test_" + LowercaseGuid)]
    [InlineData("BetsLLC_Test_0f8fad5bd9cb469fa16570867728950e")]
    [InlineData("CSPS_Dev")]
    [InlineData("CSPS_E2E")]
    [InlineData("CSPS_Legacy_Restore")]
    [InlineData("CSPS_Test_not-a-guid")]
    [InlineData("CSPS_Test_0F8FAD5B-D9CB-469F-A165-70867728950E")]
    [InlineData("CSPS_Test_" + LowercaseGuid + "x")]
    [InlineData("CSPS_Test_" + LowercaseGuid + "\n")]
    [InlineData("csps_test_" + LowercaseGuid)]
    [InlineData("x CSPS_Test_" + LowercaseGuid)]
    [InlineData("master")]
    [InlineData("")]
    [InlineData(null)]
    public void RejectsEverythingElse(string? name)
    {
        TestDatabaseName.IsDisposable(name).ShouldBeFalse();
    }
}

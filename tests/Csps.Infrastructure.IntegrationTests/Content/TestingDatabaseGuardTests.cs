#if DEBUG
using Csps.Infrastructure.Content;

namespace Csps.Infrastructure.IntegrationTests.Content;

/// <summary>
/// The Testing demo reset runs only on <c>CSPS_E2E</c> and <c>CSPS_Test_&lt;guid&gt;</c>. These checks need no database: they pin the
/// name rule, so a typo cannot refuse the end-to-end database or let a real one through.
/// </summary>
public sealed class TestingDatabaseGuardTests
{
    [Theory]
    [InlineData("CSPS_E2E")]
    [InlineData("CSPS_Test_2f3ed362-9787-4c54-8103-687d0d4f5eb8")]
    public void TheEndToEndAndPerTestNamesAreAllowed(string name) =>
        TestingDatabaseGuard.IsAllowedName(name).ShouldBeTrue();

    [Theory]
    [InlineData("CSPS_Dev")]
    [InlineData("CSPS_Legacy_Restore")]
    [InlineData("BetsLLC_Dev")]
    [InlineData("BetsLLC_E2E")]
    [InlineData("CSPS_E2E_Copy")]
    [InlineData("csps_e2e")]
    [InlineData("CSPS_E2E\n")]
    [InlineData("CSPS_Test_2F3ED362-9787-4C54-8103-687D0D4F5EB8")]
    [InlineData("csps_test_2f3ed362-9787-4c54-8103-687d0d4f5eb8")]
    [InlineData("CSPS_Test_2f3ed362-9787-4c54-8103-687d0d4f5eb8\n")]
    [InlineData("CSPS_Test_------------------------------------")]
    [InlineData("CSPS_Test_not-a-guid")]
    [InlineData("")]
    [InlineData(null)]
    public void EveryOtherNameIsRefused(string? name) =>
        TestingDatabaseGuard.IsAllowedName(name).ShouldBeFalse();
}
#endif

using Csps.Server.Security;

namespace Csps.Server.IntegrationTests.Maintenance;

/// <summary>JOB-01, T-09-76, CWE-208: only an exact key of at least 32 characters opens the maintenance run.</summary>
public sealed class MaintenanceKeyTests
{
    // Clearly fake test-only values, built here so no key-shaped text sits in the repository.
    private static readonly string Long = new('k', 40);
    private static readonly string Exact32 = new('e', 32);

    [Fact]
    public void AnEqualKeyOf32OrMoreCharactersMatches()
    {
        MaintenanceKey.Matches(Long, Long).ShouldBeTrue();
        MaintenanceKey.Matches(Exact32, Exact32).ShouldBeTrue();
    }

    [Fact]
    public void ANullOrEmptyKeyNeverMatches()
    {
        MaintenanceKey.Matches(null, Long).ShouldBeFalse();
        MaintenanceKey.Matches(string.Empty, Long).ShouldBeFalse();
    }

    [Fact]
    public void AKeyOf31CharactersNeverMatchesA40CharacterKey()
    {
        MaintenanceKey.Matches(new string('k', 31), Long).ShouldBeFalse();
    }

    [Fact]
    public void ADifferentKeyNeverMatches()
    {
        MaintenanceKey.Matches(new string('w', 40), Long).ShouldBeFalse();
        MaintenanceKey.Matches(Long + "x", Long).ShouldBeFalse();
    }

    [Fact]
    public void AConfiguredKeyUnder32CharactersNeverMatchesEvenWhenEqual()
    {
        var shortKey = new string('s', 31);

        MaintenanceKey.Matches(shortKey, shortKey).ShouldBeFalse();
        MaintenanceKey.IsConfigured(shortKey).ShouldBeFalse();
    }

    [Fact]
    public void ANullEmptyOrBlankConfiguredKeyLeavesTheEndpointClosed()
    {
        MaintenanceKey.Matches(Long, null).ShouldBeFalse();
        MaintenanceKey.Matches(Long, string.Empty).ShouldBeFalse();
        MaintenanceKey.Matches(new string(' ', 40), new string(' ', 40)).ShouldBeFalse();
    }
}

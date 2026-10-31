using Csps.Domain.Identity;

namespace Csps.Domain.UnitTests.Identity;

/// <summary>D-37: the fixed literals of the Legacy / unassigned holder.</summary>
public sealed class LegacyHolderTests
{
    [Fact]
    public void TheNameJoinsToLegacySlashUnassigned()
    {
        $"{LegacyHolder.FirstName} {LegacyHolder.LastName}".ShouldBe(LegacyHolder.DisplayName);
        LegacyHolder.DisplayName.ShouldBe("Legacy / unassigned");
    }

    [Fact]
    public void TheIdsStampsAndCreationTimeAreFixedLiterals()
    {
        new[] { LegacyHolder.Id, LegacyHolder.EditVersion }.ShouldAllBe(id => id != Guid.Empty);
        LegacyHolder.Id.ShouldNotBe(LegacyHolder.EditVersion);
        Guid.TryParse(LegacyHolder.SecurityStamp, out _).ShouldBeTrue();
        Guid.TryParse(LegacyHolder.ConcurrencyStamp, out _).ShouldBeTrue();
        LegacyHolder.SecurityStamp.ShouldNotBe(LegacyHolder.ConcurrencyStamp);
        LegacyHolder.CreatedAtUtc.ShouldBe(new DateTimeOffset(2026, 10, 28, 0, 0, 0, TimeSpan.Zero));
    }
}

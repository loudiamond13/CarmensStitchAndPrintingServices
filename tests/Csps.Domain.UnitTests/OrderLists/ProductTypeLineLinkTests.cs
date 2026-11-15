using Csps.Domain.Content;
using Csps.Domain.OrderLists;

namespace Csps.Domain.UnitTests.OrderLists;

/// <summary>D-09: a product type is filed under at most one public line, and a change to it clears the public cache.</summary>
public sealed class ProductTypeLineLinkTests
{
    private static ProductType Seeded() => ProductType.FromSeed(OrderListSeed.ProductTypes[0]);

    [Fact]
    public void ASeededProductTypeStartsUnlinked() => Seeded().ProductLineId.ShouldBeNull();

    [Fact]
    public void LinkingFilesTheTypeUnderTheLineAndReportsTheChange()
    {
        var type = Seeded();
        var line = Guid.NewGuid();

        type.LinkToLine(line).ShouldBeTrue();

        type.ProductLineId.ShouldBe(line);
    }

    [Fact]
    public void LinkingToTheSameLineAgainChangesNothing()
    {
        var type = Seeded();
        var line = Guid.NewGuid();
        type.LinkToLine(line);

        type.LinkToLine(line).ShouldBeFalse();
    }

    [Fact]
    public void LinkingToAnotherLineMovesTheType()
    {
        var type = Seeded();
        type.LinkToLine(Guid.NewGuid());
        var other = Guid.NewGuid();

        type.LinkToLine(other).ShouldBeTrue();

        type.ProductLineId.ShouldBe(other);
    }

    [Fact]
    public void UnlinkingClearsTheLinkAndANullOnAnUnlinkedTypeChangesNothing()
    {
        var type = Seeded();
        type.LinkToLine(Guid.NewGuid());

        type.LinkToLine(null).ShouldBeTrue();
        type.LinkToLine(null).ShouldBeFalse();

        type.ProductLineId.ShouldBeNull();
    }

    [Fact]
    public void AProductTypeIsAPublicContentRecordSoASavedLinkClearsThePublicCache() =>
        Seeded().ShouldBeAssignableTo<IPublicContentRecord>();
}

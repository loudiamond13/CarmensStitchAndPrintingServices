using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>D-09, D-13: the pieces are the sum of the item quantities, and the auto line is the line with the most pieces, a tie going to the first in display order.</summary>
public sealed class OrderPublicFilingTests
{
    private static readonly Guid Basketball = Guid.Parse("a5e3b9c1-0d74-4e28-8f16-3c2a7d5b9e40");
    private static readonly Guid Volleyball = Guid.Parse("b6f4c0d2-1e85-4f39-9a27-4d3b8e6c0f51");
    private static readonly Guid Moto = Guid.Parse("c7a5d1e3-2f96-4a4a-8b38-5e4c9f7d1a62");

    [Fact]
    public void TenBasketballJerseysAndSevenShortsMakeSeventeenPiecesFiledUnderBasketball()
    {
        PublicFilingItem[] items = [new(Basketball, 10), new(Basketball, 7)];

        OrderPublicFiling.Pieces(items).ShouldBe(17);
        OrderPublicFiling.AutoLine(items, [Basketball, Volleyball]).ShouldBe(Basketball);
    }

    [Fact]
    public void ALineWithMorePiecesWinsEvenWhenItComesLaterInTheDisplayOrder()
    {
        PublicFilingItem[] items = [new(Basketball, 3), new(Volleyball, 9)];

        OrderPublicFiling.AutoLine(items, [Basketball, Volleyball]).ShouldBe(Volleyball);
    }

    [Fact]
    public void ATieGoesToTheLineThatComesFirstInTheDisplayOrder()
    {
        PublicFilingItem[] items = [new(Basketball, 6), new(Volleyball, 6)];

        OrderPublicFiling.AutoLine(items, [Volleyball, Basketball]).ShouldBe(Volleyball);
        OrderPublicFiling.AutoLine(items, [Basketball, Volleyball]).ShouldBe(Basketball);
    }

    [Fact]
    public void ALineThatIsNotInTheDisplayOrderLosesATieToOneThatIs()
    {
        PublicFilingItem[] items = [new(Moto, 5), new(Volleyball, 5)];

        OrderPublicFiling.AutoLine(items, [Volleyball, Volleyball]).ShouldBe(Volleyball);
    }

    [Fact]
    public void ItemsFiledUnderNoLineFileNothingButStillCountAsPieces()
    {
        PublicFilingItem[] repairs = [new(null, 4), new(null, 2)];

        OrderPublicFiling.AutoLine(repairs, [Basketball]).ShouldBeNull();
        OrderPublicFiling.Pieces(repairs).ShouldBe(6);
    }

    [Fact]
    public void AnUnfiledItemNeverBeatsAFiledOne()
    {
        PublicFilingItem[] items = [new(null, 50), new(Moto, 1)];

        OrderPublicFiling.AutoLine(items, [Moto]).ShouldBe(Moto);
        OrderPublicFiling.Pieces(items).ShouldBe(51);
    }

    [Fact]
    public void NoItemsHaveNoPiecesAndNoLine()
    {
        OrderPublicFiling.Pieces([]).ShouldBe(0);
        OrderPublicFiling.AutoLine([], [Basketball]).ShouldBeNull();
    }

    [Fact]
    public void ANullListIsRefused()
    {
        Should.Throw<ArgumentNullException>(() => OrderPublicFiling.Pieces(null!));
        Should.Throw<ArgumentNullException>(() => OrderPublicFiling.AutoLine(null!, []));
        Should.Throw<ArgumentNullException>(() => OrderPublicFiling.AutoLine([], null!));
    }
}

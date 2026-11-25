using System.Text.RegularExpressions;
using Csps.Application.Images;

namespace Csps.Application.UnitTests.Images;

/// <summary>IMG-03, D-01: a photo's public id is 128 random bits under the order's folder and never carries the file name.</summary>
public sealed partial class PublicIdsTests
{
    private static readonly Guid OrderId = Guid.Parse("0197d4e2-3c1a-7b55-9d0e-6f2a8c4b1e37");

    [Fact]
    public void AThousandIdsAreDistinctAndEachIsTwentySixLowercaseBase32CharactersAfterTheFolder()
    {
        var ids = Enumerable.Range(0, 1000).Select(_ => PublicIds.New("csps", OrderId)).ToList();

        ids.Distinct(StringComparer.Ordinal).Count().ShouldBe(1000);
        ids.ShouldAllBe(id => IdShape().IsMatch(id));
    }

    [Fact]
    public void TheFolderIsTheRootOrdersAndTheOrderIdAndTheIdLivesInsideIt()
    {
        PublicIds.Folder("csps-dev", OrderId).ShouldBe("csps-dev/orders/0197d4e2-3c1a-7b55-9d0e-6f2a8c4b1e37");
        PublicIds.New("csps-dev", OrderId).ShouldStartWith("csps-dev/orders/0197d4e2-3c1a-7b55-9d0e-6f2a8c4b1e37/");
    }

    [Fact]
    public void TheIdTakesNothingFromAFileName()
    {
        var id = PublicIds.New("csps", OrderId);

        id.ShouldNotContain("photo", Case.Insensitive);
        id.ShouldNotContain(".jpg", Case.Insensitive);
        id.ShouldNotContain(" ");
    }

    [Fact]
    public void TheOwnFoldersAreOrdersContentAndQuotesEachWithATrailingSlash()
    {
        PublicIds.OwnFolders("csps-dev").ShouldBe(["csps-dev/orders/", "csps-dev/content/", "csps-dev/quotes/"]);
        PublicIds.OrdersPrefix("csps-dev").ShouldBe("csps-dev/orders/");
        PublicIds.ContentPrefix("csps-dev").ShouldBe("csps-dev/content/");
        PublicIds.QuotesPrefix("csps-dev").ShouldBe("csps-dev/quotes/");
    }

    [Fact]
    public void AnIdMadeByAnyOfTheThreeMakersIsInsideTheOwnFolders()
    {
        PublicIds.IsInOwnFolder("csps-dev", PublicIds.New("csps-dev", OrderId)).ShouldBeTrue();
        PublicIds.IsInOwnFolder("csps-dev", PublicIds.NewQuote("csps-dev", OrderId)).ShouldBeTrue();
        PublicIds.IsInOwnFolder("csps-dev", PublicIds.NewContent("csps-dev", "lines", OrderId)).ShouldBeTrue();
    }

    [Theory]
    [InlineData("csps-dev-more/quotes/x")]
    [InlineData("csps-dev/quotes-old/x")]
    [InlineData("csps-dev/quotes")]
    [InlineData("csps-dev/other/x")]
    [InlineData("csps/quotes/x")]
    [InlineData("CSPS-DEV/quotes/x")]
    [InlineData("csps-dev/QUOTES/x")]
    [InlineData("")]
    public void AnIdOutsideTheOwnFoldersIsNotInThem(string publicId)
    {
        PublicIds.IsInOwnFolder("csps-dev", publicId).ShouldBeFalse();
    }

    [Fact]
    public void ABlankRootOrANullIdIsRefused()
    {
        Should.Throw<ArgumentException>(() => PublicIds.OwnFolders(" "));
        Should.Throw<ArgumentException>(() => PublicIds.OrdersPrefix(string.Empty));
        Should.Throw<ArgumentException>(() => PublicIds.IsInOwnFolder(string.Empty, "csps-dev/orders/x"));
        Should.Throw<ArgumentNullException>(() => PublicIds.IsInOwnFolder("csps-dev", null!));
    }

    [GeneratedRegex("^csps/orders/0197d4e2-3c1a-7b55-9d0e-6f2a8c4b1e37/[a-z2-7]{26}$", RegexOptions.CultureInvariant)]
    private static partial Regex IdShape();
}

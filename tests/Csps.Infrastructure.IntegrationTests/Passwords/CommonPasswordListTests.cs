using Csps.Infrastructure.Passwords;

namespace Csps.Infrastructure.IntegrationTests.Passwords;

/// <summary>D-14: the embedded SecLists top-10k list is the floor when the breach service is down.</summary>
public sealed class CommonPasswordListTests
{
    [Fact]
    public void TheEmbeddedListLoadsAboutTenThousandEntries()
    {
        CommonPasswordList.Count.ShouldBeInRange(9900, 10100);
    }

    [Theory]
    [InlineData("password")]
    [InlineData("123456")]
    [InlineData("qwerty")]
    [InlineData("PassWord")]
    [InlineData("QWERTY")]
    public void CommonPasswordsAreRecognizedIgnoringCase(string password)
    {
        new CommonPasswordList().IsCommon(password).ShouldBeTrue();
    }

    [Theory]
    [InlineData("Tela-Sukat-7381")]
    [InlineData("")]
    [InlineData("passwordpassword-x9!")]
    public void OtherPasswordsAreNotCommon(string password)
    {
        new CommonPasswordList().IsCommon(password).ShouldBeFalse();
    }

    [Fact]
    public void TheListIsLoadedOnceAndSharedByEveryInstance()
    {
        var first = new CommonPasswordList();
        var second = new CommonPasswordList();

        first.IsCommon("letmein").ShouldBeTrue();
        second.IsCommon("letmein").ShouldBeTrue();
    }
}

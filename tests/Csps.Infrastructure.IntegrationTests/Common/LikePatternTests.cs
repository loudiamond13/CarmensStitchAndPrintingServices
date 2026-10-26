using Csps.Infrastructure.Common;

namespace Csps.Infrastructure.IntegrationTests.Common;

/// <summary>T-06-11, CWE-943: the shared LIKE helper keeps a typed wildcard literal.</summary>
public sealed class LikePatternTests
{
    [Fact]
    public void TheEscapeCharacterIsABackslash()
    {
        LikePattern.EscapeCharacter.ShouldBe("\\");
    }

    [Theory]
    [InlineData("plain", "plain")]
    [InlineData("", "")]
    [InlineData("50%", "50\\%")]
    [InlineData("a_b", "a\\_b")]
    [InlineData("[x]", "\\[x]")]
    [InlineData("back\\slash", "back\\\\slash")]
    [InlineData("%_[\\", "\\%\\_\\[\\\\")]
    public void EscapePutsTheEscapeCharacterBeforeEachWildcardAndBeforeItself(string typed, string expected)
    {
        LikePattern.Escape(typed).ShouldBe(expected);
    }

    [Theory]
    [InlineData("thread", "%thread%")]
    [InlineData("100%", "%100\\%%")]
    public void ContainsWrapsTheEscapedTextInPercentSigns(string typed, string expected)
    {
        LikePattern.Contains(typed).ShouldBe(expected);
    }
}
